# Tool Router Usage Examples

## 1. Creating a Session

Create a Tool Router session for a user (from client-side):

```typescript
async function createSession(userId: string) {
  const response = await fetch('/api/tool-router/create-session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userId: userId,
      toolkits: []
    })
  });

  return await response.json();
}
```

## 2. Querying Session Status

Check if user has an active session:

```typescript
import { useQuery } from "convex/react";
import { api } from "../convex/_generated/api";

function useToolRouterSession(userId: string) {
  return useQuery(api.toolRouter.sessions.getByUserId, { userId });
}
```

## 3. Background Worker Implementation

The Twitter monitor worker runs every 5 minutes:

```typescript
export const monitorTwitter = internalMutation({
  handler: async (ctx) => {
    const sessions = await ctx.db.query("toolRouterSessions").collect();

    for (const session of sessions) {
      const twitterWorker = session.backgroundWorkers?.find(
        (w) => w.type === "twitter_monitor" && w.enabled
      );

      if (!twitterWorker) continue;

      const client = await getToolRouterClient(ctx, session.userId);
      if (!client) continue;

      const results = await client.executeTools([
        {
          tool_slug: "TWITTER_GET_MENTIONS",
          arguments: { count: 10 }
        }
      ]);

      await client.disconnect();
    }
  }
});
```

## 4. Adding a New Worker Type

Create a new worker for Gmail monitoring:

```typescript
export const monitorGmail = internalMutation({
  handler: async (ctx) => {
    const sessions = await ctx.db.query("toolRouterSessions").collect();

    for (const session of sessions) {
      const gmailWorker = session.backgroundWorkers?.find(
        (w) => w.type === "gmail_monitor" && w.enabled
      );

      if (!gmailWorker) continue;

      const client = await getToolRouterClient(ctx, session.userId);
      if (!client) continue;

      const results = await client.executeTools([
        {
          tool_slug: "GMAIL_GET_UNREAD",
          arguments: { maxResults: 10 }
        }
      ]);

      await client.disconnect();
    }
  }
});
```

Then add to cron:

```typescript
crons.interval(
  "gmail-monitor",
  { minutes: 10 },
  internal.workers.gmailMonitor.monitorGmail
);
```

## 5. Viewing Task Results

Query recent background task results:

```typescript
import { useQuery } from "convex/react";
import { api } from "../convex/_generated/api";

function useBackgroundTasks(userId: string) {
  return useQuery(api.toolRouter.tasks.getRecentByUser, {
    userId,
    limit: 20
  });
}
```

## 6. Tool Discovery

Discover tools dynamically:

```typescript
const client = await getToolRouterClient(ctx, userId);

const discovery = await client.searchTools(
  "I need to send an email and create a calendar event"
);

console.log(discovery);
```

## 7. Complex Workflow

Execute a multi-step workflow:

```typescript
const client = await getToolRouterClient(ctx, userId);

const plan = await client.createPlan(
  "Get Slack messages from team channel, summarize, and email to manager",
  ["SLACK_LIST_MESSAGES", "GMAIL_SEND_EMAIL"]
);

const results = await client.executeTools([
  {
    tool_slug: "SLACK_LIST_MESSAGES",
    arguments: { channel: "team", limit: 20 }
  },
  {
    tool_slug: "GMAIL_SEND_EMAIL",
    arguments: {
      to: "manager@company.com",
      subject: "Team Channel Summary",
      body: "Summary content here"
    }
  }
]);

await client.disconnect();
```

## 8. Error Handling

Handle errors gracefully:

```typescript
try {
  const client = await getToolRouterClient(ctx, userId);
  
  if (!client) {
    throw new Error("No active session found");
  }

  const results = await client.executeTools([...]);
  
  await client.disconnect();
  
} catch (error) {
  await ctx.db.insert("backgroundTasks", {
    userId,
    sessionId: session.sessionId,
    workerId: "worker_id",
    taskType: "task_type",
    status: "failed",
    startedAt: Date.now(),
    completedAt: Date.now(),
    toolsCalled: [],
    results: {},
    error: error.message,
    userNotified: false
  });
}
```
