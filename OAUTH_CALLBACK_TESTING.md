# Testing Composio OAuth Callback

## Setup

### 1. Configure Callback URL in Composio

When creating ToolRouter sessions or setting up integrations in Composio dashboard, use this callback URL:

**Local Development:**
```
http://localhost:3000/api/composio/callback
```

**Production:**
```
https://your-domain.vercel.app/api/composio/callback
```

### 2. Environment Variables

Make sure these are set in `.env.local`:

```bash
COMPOSIO_API_KEY=your-composio-api-key
NEXT_PUBLIC_CONVEX_URL=https://your-convex-deployment.convex.cloud
```

## Testing the Flow

### Option 1: Manual OAuth URL Test

1. Start the dev server:
```bash
npm run dev
```

2. Get an OAuth URL from Composio:
```bash
# You can get this from calling COMPOSIO_MANAGE_CONNECTIONS
# Or manually construct it for testing
```

3. Open the OAuth URL in browser

4. Complete the OAuth flow

5. You should be redirected to:
```
http://localhost:3000/chat?auth_success=true&toolkit=gmail
```

6. Check your terminal logs for:
```
=== Composio OAuth Callback ===
Full URL: http://localhost:3000/api/composio/callback?...
Search Params: { ... }
```

### Option 2: AI-Triggered OAuth

1. Create a ToolRouter session:
```typescript
// POST to /api/tool-router/create-session
{
  "userId": "test@example.com",
  "toolkits": []
}
```

2. In chat, ask AI to do something requiring an integration:
```
User: "Send an email to john@example.com"
```

3. AI should detect Gmail is not connected and respond with:
```
AI: "I need access to your Gmail. Click here to connect: [URL]"
```

4. Click the URL → complete OAuth

5. Return to chat → AI should proceed with the task

## What the Callback Receives

Based on Composio's OAuth implementation, expect these parameters:

### Success Case
```
?success=true
&toolkit=gmail
&connected_account_id=acc_123abc
&state=base64_encoded_data
```

### With OAuth Code (Standard OAuth 2.0)
```
?code=auth_code_here
&state=base64_encoded_data
```

### Error Case
```
?error=access_denied
&error_description=User+cancelled
```

## Debug Logs

The callback route logs everything to console:

```javascript
=== Composio OAuth Callback ===
Full URL: [complete URL]
Search Params: [all parameters]
Decoded state: [parsed state data]
Extracted data: {
  code: "present" | "missing",
  userId: "user_id",
  sessionId: "session_id",
  success: "true",
  toolkit: "gmail",
  connectedAccountId: "acc_123"
}
✓ Updated toolkits: ["twitter", "gmail"]
Redirecting to: http://localhost:3000/chat?auth_success=true&toolkit=gmail
=== End Callback ===
```

## Verifying It Worked

After OAuth completes:

1. Check browser URL - should have `?auth_success=true&toolkit=gmail`

2. Check Convex database:
```typescript
// Query toolRouterSessions table
// Look for your userId
// connectedToolkits should now include "gmail"
```

3. Try using the tool again:
```
User: "Send an email to john@example.com"
AI: [Should now execute successfully]
```

## Common Issues

### "Callback URL not registered"
- Make sure callback URL is configured in Composio dashboard
- Must match exactly: `http://localhost:3000/api/composio/callback`

### "State parameter missing"
- Composio might not include state in all flows
- Callback handles this gracefully by attempting to parse or using state as userId

### "Toolkit not updating in database"
- Check that `NEXT_PUBLIC_CONVEX_URL` is set correctly
- Verify the query endpoint is accessible
- Check console logs for Convex update errors

### "Redirect loop"
- Clear browser cookies
- Check for conflicting auth middleware
- Verify chat route exists at `/chat`

## Next Steps

Once callback works:

1. **Add UI detection** - Show success message when `?auth_success=true` appears
2. **Auto-retry** - Automatically retry the AI request after successful auth
3. **Better buttons** - Render OAuth URLs as styled buttons instead of raw links
4. **Connection status** - Show list of connected integrations
5. **Error handling** - Display user-friendly error messages

## Testing Different Integrations

Try various toolkits to see different OAuth flows:

```
Gmail: Standard Google OAuth
Slack: Workspace-specific OAuth
GitHub: Org/repo permissions
Twitter: OAuth 2.0 with scopes
Notion: Database access permissions
```

Each might send slightly different callback parameters, but the route handles them all.

