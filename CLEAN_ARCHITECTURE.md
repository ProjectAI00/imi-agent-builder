# Clean 3-Layer AI Agent System

**Simplified, Organized, Production-Ready Architecture**

Last Updated: October 14, 2025

---

## Folder Structure (After Cleanup)

```
convex/
├── agents/              # LAYER 2 & 3: Conversational + Tool Calling
│   ├── streamingAgentLoop.ts      # Core execution engine
│   ├── streamingAgentAction.ts    # Convex wrapper
│   ├── router.ts                  # Entry point
│   ├── subagents.ts               # Subagent registry (Layer 3)
│   └── prompts/
│       ├── imi.ts                 # Main conversational agent
│       ├── executor.ts            # Tool executor agent
│       └── contextAnalyzer.ts     # (Optional) Context analysis
│
├── context/             # LAYER 1: Context Engine + Execution State
│   ├── contextProvider.ts         # Main orchestrator
│   ├── queryAnalyzer.ts           # Query complexity detection
│   ├── queryRewriter.ts           # Query expansion
│   ├── parallelSearch.ts          # Parallel vector search
│   ├── scratchpad.ts              # Execution state tracking
│   └── storage.ts                 # Context caching (TTL)
│
├── tools/               # Available Tools
│   ├── appIntegrations.ts         # 500+ apps via Composio
│   ├── searchMemory.ts            # Memory search
│   ├── searchMemoryHelpers.ts     # Memory utilities
│   └── searchTwitter.ts           # Twitter API
│
├── bridge/              # Tool Bridges (for external calls)
│   ├── searchMemoryAction.ts
│   ├── searchTwitterAction.ts
│   └── appIntegrationsAction.ts
│
├── chat/                # Message Handling
│   ├── sendMessage.ts             # Message entry point
│   └── threads.ts                 # Thread management
│
├── memory/              # Memory Extraction
│   └── extractMemories.ts
│
├── logs/                # Telemetry
│   └── telemetry.ts
│
├── toolRouter/          # Composio MCP Sessions
│   └── sessions.ts
│
├── users/               # User Management
│   └── ...
│
├── auth/                # Authentication (Better Auth)
│   └── ...
│
├── lib/                 # Shared Utilities
│   └── ...
│
├── workers/             # Background Workers (Optional)
│   └── twitterMonitor.ts
│
├── schema.ts            # Database Schema
├── convex.config.ts     # Convex Configuration
├── crons.ts             # Scheduled Jobs
└── usage.ts             # Usage Tracking
```

---

## The 3 Layers

### **Layer 1: Context Engine** (`context/`)

**Purpose**: Provide relevant context from past conversations and external data

**Files**:
- `contextProvider.ts` - Main orchestrator (hybrid search)
- `queryAnalyzer.ts` - Determines query complexity
- `queryRewriter.ts` - LLM-powered query expansion
- `parallelSearch.ts` - Parallel vector search
- `storage.ts` - Context caching with TTL
- `scratchpad.ts` - Execution state tracking

**Flow**:
```
User message
    ↓
queryAnalyzer (simple or complex?)
    ↓
[Fast Path]        OR        [Smart Path]
Direct search               Query rewriting
~150ms                      + parallel searches
                            ~1s
    ↓                           ↓
Results cached (3-5 min TTL)
    ↓
Injected into Layer 2 as <relevant_memories>
```

---

### **Layer 2: Conversational Agent** (`agents/`)

**Purpose**: User-facing AI with personality and conversational flow

**Files**:
- `streamingAgentLoop.ts` - Core execution engine
- `streamingAgentAction.ts` - Convex action wrapper
- `router.ts` - Entry point for all messages
- `prompts/imi.ts` - Main agent personality

**Flow**:
```
router.ts receives message
    ↓
Runs Layer 1 context fetch
    ↓
streamingAgentAction with context
    ↓
streamingAgentLoop streams events:
- text_delta (incremental text)
- tool_call_start/complete
- subagent_start/complete (Layer 3)
- thinking (debug mode)
    ↓
Response streamed to UI
```

---

### **Layer 3: Tool Calling Agent** (`agents/subagents.ts`)

**Purpose**: Execute API integrations in the background

**Files**:
- `subagents.ts` - Subagent registry
- `prompts/executor.ts` - Tool executor personality

**How it works**:
1. Layer 2 decides it needs tool execution
2. Calls "task" tool to delegate to subagent
3. `streamingAgentLoop` spawns NEW agent with:
   - Executor system prompt
   - Limited tools (app_integrations + memory_search)
   - Lower temperature (0.2)
   - Fewer iterations (5 max)
4. Subagent executes and returns results
5. Layer 2 formats for user

**Current Subagents**:
- `tool_executor` - API integrations and multi-step workflows

---

## Key Design Decisions

### **Why Context in One Folder?**
- Layer 1 is **conceptually unified**: context retrieval + execution tracking
- `scratchpad.ts` tracks execution state (part of context for debugging)
- All context-related logic in one place

### **Why Agents in One Folder?**
- Layer 2 & 3 use **the same engine** (`streamingAgentLoop`)
- Only difference is system prompts and tool access
- Keeps related code together

### **What We Deleted**:
- ❌ `workflows/` - Reorganized into `context/`
- ❌ `plans/` - Unused planning system
- ❌ `debug/` - Development-only utilities
- ❌ `test/` - Test files
- ❌ `migrations/` - One-time migration scripts
- ❌ `tools/createPlan.ts` - Unused plan creation
- ❌ `tools/toolLogger.ts` - Unused logging

---

## Environment Setup

```bash
# Required
OPENROUTER_API_KEY=xxx
COMPOSIO_API_KEY=xxx
CONVEX_DEPLOYMENT=xxx

# Agent Configuration
STREAMING_AGENT_ENABLED=true                    # Enable streaming agent
OR_MODEL=google/gemini-2.0-flash-exp:free      # Main agent model
OR_MODEL_EXECUTOR=same                          # Tool executor model (optional)

# Optional
SHOW_AGENT_THINKING=false                       # Debug mode
```

---

## Message Flow

```
1. User sends message to `/chat/sendMessage.ts`
       ↓
2. Message saved to database
       ↓
3. Router `/agents/router.ts` invoked
       ↓
4. Layer 1: `/context/contextProvider.ts` fetches relevant context (~150ms-1s)
       ↓
5. Layer 2: `/agents/streamingAgentAction.ts` called with context
       ↓
6. `streamingAgentLoop.ts` runs with context injected
       ↓
7. If tool execution needed:
   - Delegates to Layer 3 via "task" tool
   - `/agents/subagents.ts` → tool_executor runs
   - Results returned to Layer 2
       ↓
8. Layer 2 formats response with personality
       ↓
9. Events streamed to UI in real-time
       ↓
10. Final response saved to database
```

---

## Database Schema (Relevant Tables)

**`threadContext`** - Short-lived context cache (Layer 1)
- TTL: 5-10 minutes
- Contains: contextType, summary, relevanceScore
- Auto-expires via index

**`executionScratchpads`** - Execution state tracking (Layer 1)
- Contains: jobId, steps, artifacts, status
- Used for debugging and observability

**`userMemories`** - Persistent conversation memory
- Contains: entities, facts, priority
- Vector-searchable

**`toolRouterSessions`** - Composio MCP sessions
- 7-day TTL
- Tracks connected apps

---

## Tool System

### Available Tools (Layer 3)

1. **memory_search** - Search past conversations
2. **twitter_search** - Search Twitter via RapidAPI
3. **app_integrations** - 500+ apps via Composio (search, execute, check_connections, initiate_connection)
4. **task** - Delegate to subagent (only available when subagents configured)

---

## Adding New Subagents

1. Create prompt in `agents/prompts/yourAgent.ts`
2. Add to `agents/subagents.ts`:

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

3. Automatically available via "task" tool

---

## Performance Characteristics

| Component | Latency | Cacheable | Notes |
|-----------|---------|-----------|-------|
| Layer 1 (Fast Path) | ~150ms | Yes (3-5min) | Direct vector search |
| Layer 1 (Smart Path) | ~1s | Yes (3-5min) | Query rewriting + parallel search |
| Layer 2 (Streaming) | Real-time | No | Event-driven streaming |
| Layer 3 (Tool Calling) | Varies | No | Depends on API latency |

---

## What's Next?

**Remaining cleanup (low priority)**:
- Check `lib/` folder for dead code
- Review `workers/` if not using Twitter monitor
- Clean up `crons.ts` if workers are removed

**Future enhancements**:
- Add more specialized subagents (email_writer, doc_creator, data_analyzer)
- Implement Composio background workers
- Add multi-modal support (images, PDFs)
- Enhance context diversity algorithms

---

## Quick Reference

### Key Entry Points
- **User sends message**: `chat/sendMessage.ts`
- **Router**: `agents/router.ts`
- **Layer 1**: `context/contextProvider.ts`
- **Layer 2**: `agents/streamingAgentAction.ts`
- **Layer 3**: `agents/subagents.ts`

### Key Concepts
- **Subagent**: Specialized agent with focused task, limited tools, and custom prompt
- **Scratchpad**: Observable execution state for debugging
- **Context TTL**: Short-lived cache (3-5 min) to reduce Layer 1 latency
- **Event Streaming**: Real-time UI updates during agent execution

---

**Built with**: Convex, Claude Agent SDK patterns, OpenRouter, Composio, Vercel AI SDK

**Architecture Status**: ✅ Clean, organized, production-ready
