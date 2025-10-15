# Agentech System Architecture

**Clean 3-Layer AI Agent System built on Convex + Claude patterns**

Last Updated: October 14, 2025

---

## Overview

This system implements a production-ready, event-streaming AI agent architecture with three distinct layers:

1. **Layer 1: Context Engine** - Intelligent memory retrieval and context provisioning
2. **Layer 2: Conversational Agent** - User-facing AI with personality
3. **Layer 3: Tool Calling Agent** - Background execution of API integrations

---

## Layer 1: Context Engine 🧠

**Purpose**: Provide relevant context from past conversations and external data sources

**Key Files**:
- `convex/workflows/contextProvider.ts` - Hybrid search orchestration
- `convex/workflows/queryAnalyzer.ts` - Determines query complexity
- `convex/workflows/queryRewriter.ts` - LLM-powered query expansion
- `convex/workflows/parallelSearch.ts` - Parallel vector search
- `convex/context/storage.ts` - Context caching with TTL

**How it Works**:
1. User sends message
2. Query analyzer determines if it's simple (direct search) or complex (needs rewriting)
3. **Fast Path** (~150ms): Direct vector search for simple queries
4. **Smart Path** (~1s): Query rewriting + parallel searches for conversational queries
5. Results cached with 3-5 minute TTL in `threadContext` table
6. Context injected into Layer 2's prompt as `<relevant_memories>`

**Performance**:
- Fast path: 150ms average
- Smart path: 1s average
- Semantic deduplication at 95% similarity threshold
- Automatic diversity boosting

---

## Layer 2: Conversational Agent 💬

**Purpose**: Main user-facing agent with personality and conversational flow

**Key Files**:
- `convex/agents/streamingAgentLoop.ts` - Core execution engine
- `convex/agents/streamingAgentAction.ts` - Convex action wrapper
- `convex/agents/router.ts` - Entry point for all messages
- `convex/agents/prompts/imi.ts` - Main agent personality

**How it Works**:
1. Router receives user message → runs Layer 1 context fetch
2. Calls `streamingAgentAction` with context-enhanced prompt
3. `streamingAgentLoop` streams events in real-time:
   - `text_delta` - Incremental text generation
   - `tool_call_start` - Tool execution begins
   - `tool_call_complete` - Tool results ready
   - `subagent_start/complete` - Layer 3 delegation
   - `thinking` - Internal reasoning (debug mode)
4. Agent can call tools directly OR delegate to Layer 3 subagents
5. Response streamed to UI with 90ms throttle

**Event Streaming**:
```typescript
type AgentEvent =
  | { type: 'thinking'; content: string }
  | { type: 'tool_call_start'; tool: string; input: any; callId: string }
  | { type: 'tool_call_complete'; tool: string; result: any; callId: string }
  | { type: 'text_delta'; delta: string }
  | { type: 'subagent_start'; agent: string; task: string }
  | { type: 'subagent_complete'; agent: string; result: string }
  | { type: 'error'; error: string; recoverable: boolean }
  | { type: 'complete'; finalText: string; stats: AgentStats };
```

**Model Configuration**:
- Model: Configurable via `OR_MODEL` env var
- Temperature: 0.7 (conversational)
- Max iterations: 10
- Reasoning: Excluded for speed

---

## Layer 3: Tool Calling Agent ⚙️

**Purpose**: Execute API integrations and multi-step workflows in the background

**Key Files**:
- `convex/agents/subagents.ts` - Subagent registry
- `convex/agents/prompts/executor.ts` - Tool executor prompt
- `convex/tools/appIntegrations.ts` - 500+ app integrations via Composio
- `convex/tools/searchMemory.ts` - Memory search
- `convex/tools/searchTwitter.ts` - Twitter API

**How it Works**:
1. Layer 2 agent decides it needs to execute tools
2. Calls "task" tool with subagent delegation
3. `streamingAgentLoop` spawns a NEW agent instance with:
   - Specialized system prompt (executor.ts)
   - Limited tool access (only app_integrations + memory_search)
   - Lower temperature (0.2 for deterministic execution)
   - Fewer iterations (5 max)
4. Subagent executes tools and returns structured results
5. Layer 2 formats results with personality for user

**Available Subagents**:
- `tool_executor` - API integrations and multi-step workflows

**Subagent Pattern**:
```typescript
export const toolExecutor: SubagentDefinition = {
  name: "Tool Executor",
  description: "Execute API integrations...",
  tools: ["app_integrations", "memory_search"],
  systemPrompt: EXECUTOR_SYSTEM_PROMPT,
  model: process.env.OR_MODEL_EXECUTOR,
};
```

---

## Key Components

### Router (`convex/agents/router.ts`)
- Single entry point for all user messages
- Runs Layer 1 context fetch synchronously
- Routes to appropriate agent system based on env vars:
  - **Primary**: `STREAMING_AGENT_ENABLED=true` (recommended)
  - **Fallback**: `CLAUDE_AGENT_ENABLED=true` (HTTP orchestrator)

### Message Flow
```
User sends message
    ↓
router.route() [Entry point]
    ↓
contextProvider.provideContext() [Layer 1 - ~150ms-1s]
    ↓
streamingAgentAction.streamAgentResponse() [Layer 2 starts]
    ↓
streamingAgentLoop() with context injected
    ↓
[If needs tool execution]
    ↓
Delegates to subagent via "task" tool [Layer 3]
    ↓
Subagent executes → returns results
    ↓
Layer 2 formats with personality
    ↓
Streams to user via events
```

### Scratchpad System
Execution state tracking for debugging and observability:
- Step-by-step execution logs
- Artifact storage (intermediate results)
- Retry tracking
- Escalation after 3 failed tool calls

**Schema**:
```typescript
executionScratchpads: {
  jobId, userId, threadId, status,
  steps: [{ stepId, status, result, error, retries }],
  artifacts: [{ key, value, visibility, createdAt }],
}
```

---

## Data Architecture

### Key Tables

**`threadContext`** - Short-lived context cache
- TTL: 5-10 minutes
- Contains: contextType, summary, relevanceScore
- Auto-expires via index

**`userMemories`** - Persistent conversation memory
- Contains: entities, facts, priority
- Soft delete support
- Vector-searchable

**`executionScratchpads`** - Observable execution state
- Real-time step tracking
- Rollback support
- Artifact storage

**`toolRouterSessions`** - Composio MCP sessions
- 7-day TTL
- Connection tracking
- 60-second sync cache

---

## Tool System

### Available Tools

1. **memory_search** - Search past conversations
   - Fast model filtering (gpt-oss-20b)
   - Returns facts + thread context

2. **twitter_search** - Search Twitter (RapidAPI)
   - Supports `from:username` syntax
   - Returns up to 50 tweets with metrics

3. **app_integrations** - 500+ apps via Composio
   - Actions: search, execute, check_connections, initiate_connection
   - OAuth flow handling
   - Connection deduplication

4. **task** - Delegate to subagent
   - Only available when subagents configured
   - Supports recursion (max depth: 3)

---

## Environment Variables

```bash
# Required
OPENROUTER_API_KEY=xxx
COMPOSIO_API_KEY=xxx
CONVEX_DEPLOYMENT=xxx

# Agent Configuration
STREAMING_AGENT_ENABLED=true        # Use streaming agent (recommended)
OR_MODEL=google/gemini-2.0-flash-exp:free  # Main agent model
OR_MODEL_EXECUTOR=same              # Tool executor model (optional)

# Optional
CLAUDE_AGENT_ENABLED=false          # HTTP orchestrator fallback
SHOW_AGENT_THINKING=false           # Debug mode
```

---

## Adding New Subagents

1. Create prompt in `convex/agents/prompts/yourAgent.ts`
2. Define in `convex/agents/subagents.ts`:

```typescript
export const yourAgent: SubagentDefinition = {
  name: "Your Agent",
  description: "When to use this agent...",
  tools: ["specific", "tools"],
  systemPrompt: YOUR_SYSTEM_PROMPT,
  model: "optional-override",
};

export const SUBAGENTS = {
  tool_executor: toolExecutor,
  your_agent: yourAgent,  // Add here
};
```

3. Subagent automatically available via "task" tool

---

## Performance Characteristics

| Layer | Latency | Cacheable | Parallel |
|-------|---------|-----------|----------|
| Layer 1 (Context) | 150ms-1s | Yes (3-5min) | Yes |
| Layer 2 (Conversational) | Streaming | No | No |
| Layer 3 (Tool Calling) | Varies | No | Yes |

**Optimizations**:
- Context caching reduces Layer 1 to ~10ms on cache hit
- Parallel tool execution in Layer 3
- Event streaming prevents blocking
- Query rewriting only on complex queries

---

## Debugging

### View Scratchpad State
```typescript
const pad = await ctx.runQuery(api.workflows.scratchpad.getByJobId, {
  jobId: "thread:timestamp"
});
```

### Enable Thinking Mode
```bash
SHOW_AGENT_THINKING=true
```

### Check Context Cache
```typescript
const context = await ctx.runQuery(api.context.storage.getContextSummary, {
  threadId, contextTypes: ["memory"]
});
```

---

## Migration Notes

### Removed (Dead Code)
- ❌ Old Convex Agent SDK (`imiAgent.ts`, `roastAgent.ts`, `toolCallingAgent.ts`)
- ❌ Convex Workflow system (`agentOrchestration.ts`, `steps.ts`)
- ❌ Legacy `getAgent()` pattern
- ❌ Roast agent feature

### Current System (Active)
- ✅ Claude Agent SDK patterns (adapted for serverless)
- ✅ Event streaming architecture
- ✅ Subagent delegation via "task" tool
- ✅ Hybrid context engine

---

## Future Enhancements

- [ ] Add more specialized subagents (email_writer, doc_creator, data_analyzer)
- [ ] Implement Composio background workers
- [ ] Add plan execution tracking (Layer 3 planning)
- [ ] Enhance context diversity algorithms
- [ ] Add multi-modal support (images, PDFs)

---

## File Structure

```
convex/
├── agents/
│   ├── streamingAgentLoop.ts     # Core execution engine (Layer 2 & 3)
│   ├── streamingAgentAction.ts   # Convex action wrapper
│   ├── router.ts                 # Entry point
│   ├── subagents.ts              # Subagent registry
│   └── prompts/
│       ├── imi.ts                # Main agent personality
│       └── executor.ts           # Tool executor prompt
├── workflows/
│   ├── contextProvider.ts        # Layer 1 orchestrator
│   ├── queryAnalyzer.ts          # Query complexity detection
│   ├── queryRewriter.ts          # Query expansion
│   ├── parallelSearch.ts         # Parallel vector search
│   └── scratchpad.ts             # Execution state tracking
├── context/
│   └── storage.ts                # Context caching
├── tools/
│   ├── appIntegrations.ts        # Composio integration
│   ├── searchMemory.ts           # Memory search
│   └── searchTwitter.ts          # Twitter API
├── bridge/
│   ├── searchMemoryAction.ts    # Tool bridges for external calls
│   └── appIntegrationsAction.ts
└── chat/
    ├── sendMessage.ts            # Message handling
    └── threads.ts                # Thread management
```

---

**Built with**: Convex, Claude Agent SDK patterns, OpenRouter, Composio, Vercel AI SDK
