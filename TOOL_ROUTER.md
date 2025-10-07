# Tool Router Integration

This project integrates Composio's Tool Router for autonomous AI agent capabilities across 500+ applications.

## Architecture

The Tool Router uses the Model Context Protocol (MCP) to provide a unified interface for tool discovery, authentication, and execution.

```
User → Tool Router Session → MCP Client → Background Workers → Tools Execution
```

## Setup

### 1. Install Dependencies

```bash
npm install
```

Dependencies added:
- `@modelcontextprotocol/sdk` - MCP client library
- `composio-core` - Composio SDK

### 2. Configure Environment

Add your Composio API key to `.env.local`:

```bash
COMPOSIO_API_KEY=your-composio-api-key
```

Get your API key from: https://app.composio.dev/settings

### 3. Deploy Database Schema

The schema includes two new tables:
- `toolRouterSessions` - Stores user session URLs and configuration
- `backgroundTasks` - Logs background task execution results

Push schema changes:

```bash
npx convex dev
```

## Usage

### Creating a Session

Create a Tool Router session for a user:

```typescript
const response = await fetch('/api/tool-router/create-session', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    userId: 'user123',
    toolkits: [] // Empty = all 500+ toolkits available
  })
});

const { sessionId, sessionUrl } = await response.json();
```

### Background Workers

Background workers run on scheduled intervals via Convex cron jobs.

Current workers:
- `twitter-monitor` - Runs every 5 minutes

Configure workers in `convex/crons.ts`.

### Tool Router Client

The `ToolRouterClient` class provides methods for:

- `searchTools(taskDescription)` - Discover relevant tools
- `createPlan(useCase, toolSlugs)` - Generate execution plans
- `executeTools(toolCalls)` - Execute up to 20 tools in parallel
- `manageConnections(toolkits)` - Handle authentication

### Example: Twitter Monitoring

```typescript
const client = await getToolRouterClient(ctx, userId);

const discovery = await client.searchTools(
  "Check my Twitter mentions",
  { toolkits: ["twitter"] }
);

const results = await client.executeTools([
  {
    tool_slug: "TWITTER_GET_MENTIONS",
    arguments: { count: 10 }
  }
]);

await client.disconnect();
```

## Key Features

### Discovery

Tool Router automatically discovers which tools you need:

```typescript
const discovery = await client.searchTools(
  "Send an email and create a GitHub issue"
);
```

Returns relevant tools from Gmail and GitHub toolkits.

### Parallel Execution

Execute up to 20 tools simultaneously:

```typescript
await client.executeTools([
  { tool_slug: "TWITTER_GET_MENTIONS", arguments: {...} },
  { tool_slug: "GMAIL_GET_UNREAD", arguments: {...} },
  { tool_slug: "SLACK_GET_MESSAGES", arguments: {...} }
]);
```

### Persistent Sessions

Sessions remain active and authenticated, eliminating re-auth overhead on every background task execution.

## Database Schema

### toolRouterSessions

```typescript
{
  userId: string
  sessionId: string
  sessionUrl: string
  connectedToolkits: string[]
  createdAt: number
  lastActiveAt: number
  expiresAt?: number
  backgroundWorkers?: {
    id: string
    type: string
    enabled: boolean
    schedule: string
    config: any
    lastRun?: number
    nextRun?: number
  }[]
}
```

### backgroundTasks

```typescript
{
  userId: string
  sessionId: string
  workerId: string
  taskType: string
  status: string
  startedAt: number
  completedAt?: number
  toolsCalled: string[]
  results: any
  error?: string
  userNotified: boolean
  notificationMessage?: string
}
```

## Meta Tools

Tool Router exposes six meta tools via MCP:

1. `COMPOSIO_SEARCH_TOOLS` - Discover tools
2. `COMPOSIO_CREATE_PLAN` - Generate execution plans
3. `COMPOSIO_MANAGE_CONNECTIONS` - Handle authentication
4. `COMPOSIO_MULTI_EXECUTE_TOOL` - Execute tools in parallel
5. `COMPOSIO_REMOTE_WORKBENCH` - Python sandbox for complex operations
6. `COMPOSIO_REMOTE_BASH_TOOL` - Bash commands for file operations

## References

- [Tool Router Documentation](https://docs.composio.dev/docs/tool-router/quick-start)
- [Composio Changelog](https://docs.composio.dev/changelog/2025/9/26)
- [MCP Protocol](https://modelcontextprotocol.io)
