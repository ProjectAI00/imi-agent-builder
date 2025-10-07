# App Integrations Connection Management

## How Connection Deduplication Works

The `appIntegrations` tool now includes automatic deduplication to prevent duplicate connections per user per app.

### Rules

1. **One Active Connection Per App Per User**
   - Each user can have only ONE ACTIVE connection to an app (e.g., Gmail, Notion)
   - If user already has an ACTIVE connection, attempting to connect again will return: "already connected"

2. **Reuse Recent INITIATED Connections**
   - If a connection was just initiated (within last 10 minutes) but not completed
   - The tool will return the same OAuth URL instead of creating a duplicate
   - This prevents duplicate entries when user clicks "connect" multiple times

3. **Ignore Stale INITIATED Connections**
   - Connections in INITIATED state older than 10 minutes are considered stale
   - New connection attempts will create a fresh OAuth flow
   - Stale connections are logged but don't block new attempts

4. **Account-Level Uniqueness**
   - ✅ Same user can connect DIFFERENT Google accounts to Gmail (e.g., personal + work)
   - ✅ Same user can connect DIFFERENT Notion workspaces
   - ❌ Same user CANNOT connect the SAME account twice
   - Composio handles account-level deduplication on their end

## Current State (Your Connections)

Based on Composio API query for user `advicebyaimar`:

```
✓ Gmail: ACTIVE (ca_HkJ7q_FmXf2Q)
  - Connected: Oct 5, 2025 at 22:02
  - Email: project.ai.admn@gmail.com
  - Status: Working

✓ Notion: ACTIVE (ca_rifNVkl6A-tV)
  - Connected: Oct 5, 2025 at 22:56
  - Workspace: "Workspace van Project AI"
  - Status: Working

⚠️ Notion: INITIATED (ca_DvWkVMzNy_co) - STALE
  - Started: Oct 5, 2025 at 22:56 (11+ hours ago)
  - Status: Incomplete OAuth flow
  - Will be ignored by deduplication logic

⚠️ Google Docs: INITIATED (ca_f_jaRownWVgq) - STALE
  - Started: Oct 5, 2025 at 22:30 (12+ hours ago)
  - Status: Incomplete OAuth flow
  - Will be ignored by deduplication logic

⚠️ Google Docs: INITIATED (ca_TmaDQ_w5DRLC) - STALE
  - Started: Oct 5, 2025 at 22:50 (11+ hours ago)
  - Status: Incomplete OAuth flow
  - Will be ignored by deduplication logic
```

## Why Stale Connections Exist

**Root Cause**: All these connections were created with the wrong callback URL:
```
callback_url: "https://backend.composio.dev/api/v1/auth-apps/add"
```

This should have been:
```
callback_url: "http://localhost:3000/api/composio/callback"
```

**What happened**:
1. User clicked "Authenticate Google Docs"
2. OAuth popup opened with Composio's redirect
3. User authenticated with Google
4. Google redirected to Composio's URL (not your app)
5. Connection stayed in INITIATED state forever
6. Your app never received the completion callback

**Fixed**: Session creation now includes correct `callback_url` config (convex/tools/appIntegrations.ts:122)

## Testing the Fix

### Step 1: Verify Session Has Correct Callback

Your current session was created BEFORE the fix. To get the new callback URL:

```bash
# Option A: Wait 7 days for session to expire naturally
# Option B: Force new session by deleting current one

# Delete existing session (forces recreation with correct callback)
npx convex run toolRouter/sessions:deleteByUserId '{"userId":"advicebyaimar"}'
```

After deletion, next AI interaction will create a fresh session with correct callback URL.

### Step 2: Test New Connection

1. Ask AI: "Connect to Google Docs"
2. Deduplication check runs:
   - ✓ No ACTIVE Google Docs connection found
   - ✓ Found 2 stale INITIATED connections (older than 10 minutes)
   - ✓ Proceeds with fresh connection attempt
3. AI returns OAuth URL with correct callback
4. Popup opens automatically (via OAuthPopupHandler)
5. User authenticates with Google
6. Google redirects to `http://localhost:3000/api/composio/callback`
7. Callback page shows success checkmark
8. Popup closes automatically
9. Connection status changes to ACTIVE
10. Database syncs the new connection

### Step 3: Verify Deduplication Works

After successful connection:

1. Ask AI: "Connect to Google Docs again"
2. Expected result: "Google Docs is already connected! No need to authenticate again."

## Debug Commands

### List all sessions
```bash
npx convex run debug/checkToolRouterSessions:listAllSessions
```

### Check your specific session
```bash
npx convex run debug/checkToolRouterSessions:getSessionByUser '{"userId":"advicebyaimar"}'
```

### List stale connections
```bash
npx convex run debug/cleanupStaleConnections:listStaleConnections '{"userId":"advicebyaimar","olderThanMinutes":10}'
```

### Check connection status via AI
Just ask the AI:
- "What apps am I connected to?"
- "Check my app connections"

The AI will use `appIntegrations` with action "check_connections"

## Manual Cleanup (Optional)

Stale INITIATED connections don't hurt anything - they're automatically ignored by deduplication logic. But if you want to clean them up manually:

1. Visit Composio Dashboard: https://app.composio.dev
2. Navigate to Connected Accounts
3. Filter by user: `advicebyaimar`
4. Delete the INITIATED connections manually

Note: Composio v3 API doesn't provide a programmatic delete endpoint yet.

## Implementation Details

### Deduplication Flow (convex/tools/appIntegrations.ts:368-442)

```typescript
case "initiate_connection": {
  // 1. Normalize app name
  const toolkitName = args.appName.toLowerCase(); // "gmail", "googledocs", etc.

  // 2. Query existing connections from Composio
  const existingConns = await fetch(composio_api);

  // 3. Filter connections for this specific app
  const appConnections = existingConns.items?.filter(conn =>
    conn.toolkit?.slug === toolkitName
  );

  // 4. Check for ACTIVE connection
  const activeConn = appConnections.find(c => c.status === "ACTIVE");
  if (activeConn) {
    return { message: "Already connected!" };
  }

  // 5. Check for recent INITIATED (within 10 minutes)
  const recentInitiated = appConnections.filter(c =>
    c.status === "INITIATED" &&
    isWithinLast10Minutes(c.created_at)
  );
  if (recentInitiated.length > 0) {
    return { message: "Here's the existing auth link", url: recentInitiated[0].redirectUrl };
  }

  // 6. Log stale INITIATED for monitoring
  const staleInitiated = appConnections.filter(c =>
    c.status === "INITIATED" &&
    isOlderThan10Minutes(c.created_at)
  );
  if (staleInitiated.length > 0) {
    console.log(`Found ${staleInitiated.length} stale connections, will ignore`);
  }

  // 7. Proceed with fresh connection
  const result = await client.manageConnections([toolkitName]);
  // ...
}
```

### Connection Sync (convex/tools/appIntegrations.ts:180-210)

Before EVERY tool action, the system:
1. Queries Composio for latest connection status
2. Extracts ACTIVE connections
3. Compares with local database
4. Updates database if connections changed

This ensures:
- AI always knows current connection state
- Newly completed OAuth flows are detected immediately
- Deleted/revoked connections are reflected in DB

## FAQ

**Q: Can I connect multiple Google accounts to Gmail?**
A: Yes! Each Google account creates a separate connection. Composio handles this automatically.

**Q: What if I want to switch to a different Gmail account?**
A: Disconnect the current one first (via Composio dashboard or by revoking access in Google settings), then connect the new account.

**Q: Why are my old INITIATED connections still showing up?**
A: Composio v3 doesn't support programmatic deletion. These are harmless and ignored by our system.

**Q: How do I know if the callback URL is correct?**
A: Check your session creation logs. After deleting and recreating the session, you should see:
```
config: {
  callback_url: "http://localhost:3000/api/composio/callback"
}
```

**Q: What happens if session expires?**
A: After 7 days of inactivity, sessions auto-expire. Next AI interaction creates a fresh session with latest config (including correct callback URL).
