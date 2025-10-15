# Supermemory Hybrid Search Integration Plan

## Overview
Integrate Supermemory's intelligent search routing and query rewriting patterns into our Layer 1 (Context Provider) to improve memory retrieval quality and conversation awareness.

---

## Current Architecture Issues

### Problems:
1. **No intelligence** - Always fetches same 5 recent memories
2. **No conversation awareness** - "tell me more" returns identical results
3. **No query understanding** - Takes user message literally
4. **Repetitive** - Same 4-5 facts on every turn
5. **Poor relevance** - Doesn't match query intent to memories

### Current Flow:
```
User message → Layer 1 (async, unused) → Layer 2 queries context.storage (empty)
  → Layer 2 fallback: fetch 5 recent memories → GLM-4.5 response
```

---

## Target Architecture (Supermemory-Inspired)

### New Flow:
```
User message
  ↓
Layer 1: Query Analyzer (5ms)
  ├─ Simple? → Fast Path: Direct vector search (150ms)
  └─ Complex? → Smart Path: Gemini rewrite → Parallel searches (1s)
  ↓
Merge, dedupe, rank results
  ↓
Store in context.storage
  ↓
Layer 2: Read context → GLM-4.5 response
```

### Key Improvements:
✅ **Conversation-aware** - Analyzes recent messages to avoid repetition
✅ **Query understanding** - Rewrites queries for better matching
✅ **Intelligent routing** - Fast for simple, smart for complex
✅ **Diverse results** - Fetches NEW relevant memories each turn
✅ **Better relevance** - Multiple search variations find more

---

## Implementation Phases

### **Phase 1: Query Analyzer**
**Goal:** Detect whether to use fast path or smart path

**Files to create:**
- `/convex/workflows/queryAnalyzer.ts`

**Logic:**
```typescript
interface QueryAnalysis {
  isComplex: boolean;
  queryType: 'simple' | 'conversational' | 'followup' | 'recall';
  needsRewrite: boolean;
  reasoning: string;
}

function analyzeQuery(
  userMessage: string,
  recentMessages: Array<{role: string, content: string}>
): QueryAnalysis
```

**Decision Factors:**
- **Simple (fast path):**
  - Direct questions: "What's my startup about?"
  - Factual recall: "My favorite color?"
  - Short queries: <15 words
  
- **Complex (smart path):**
  - Follow-ups: "tell me more", "what else", "anything else"
  - Conversational: "we talked about...", "remember when..."
  - Multi-concept: "my startup and funding plans"
  - Vague: "what do you know about me?"

**Time:** 15 minutes

---

### **Phase 2: Query Rewriter (Gemini)**
**Goal:** Generate multiple search variations for complex queries

**Files to create:**
- `/convex/workflows/queryRewriter.ts`

**Implementation:**
```typescript
interface QueryRewrites {
  original: string;
  variations: string[];
  strategy: 'expansion' | 'conversation_context' | 'multi_concept';
}

async function rewriteQuery(
  userMessage: string,
  conversationHistory: Array<{role: string, content: string}>,
  previousContext: string[]  // What was already fetched
): Promise<QueryRewrites>
```

**Gemini Prompt Structure:**
```
User's current question: "{userMessage}"

Recent conversation:
{last 3-5 messages}

Previously retrieved facts (DO NOT repeat):
{previousContext}

Generate 3-4 search query variations that:
1. Expand abbreviations and technical terms
2. Consider conversation context (what's already discussed)
3. Fetch NEW information, not repeat previous facts
4. Handle follow-up intent ("tell me more" → search related but different)

Return as JSON array of strings.
```

**Time:** 30 minutes

---

### **Phase 3: Parallel Vector Search + Merge**
**Goal:** Execute multiple searches and combine results intelligently

**Files to create:**
- `/convex/workflows/parallelSearch.ts`

**Implementation:**
```typescript
interface SearchResult {
  memoryId: string;
  fact: string;
  score: number;
  source: string; // which query variation found it
}

async function parallelSearch(
  queries: string[],
  userId: string,
  threshold: number = 0.7
): Promise<SearchResult[]>

function mergeAndDedupe(
  results: SearchResult[][],
  maxResults: number = 10
): SearchResult[]
```

**Merge Logic:**
```typescript
// 1. Flatten all results
// 2. Dedupe by memoryId (keep highest score)
// 3. Sort by score descending
// 4. Take top N
// 5. Optional: boost diversity (different memory sources)
```

**Deduplication Strategy:**
- Exact match: Same memoryId
- Semantic similarity: >95% cosine similarity between facts
- Keep highest scored version

**Time:** 20 minutes

---

### **Phase 4: Refactor contextProvider.ts**
**Goal:** Wire up hybrid search system into Layer 1

**Files to modify:**
- `/convex/workflows/contextProvider.ts`

**New Flow:**
```typescript
export const provideContext = internalAction({
  handler: async (ctx, { threadId, userId, userMessage, messageId }) => {
    // 1. Get recent conversation
    const recentMessages = await getRecentMessages(ctx, threadId, limit: 5);
    
    // 2. Get previously fetched context (to avoid repetition)
    const previousContext = await getPreviousContext(ctx, threadId, maxAgeMs: 60000);
    
    // 3. Analyze query
    const analysis = analyzeQuery(userMessage, recentMessages);
    
    let memories: SearchResult[];
    
    if (!analysis.needsRewrite) {
      // FAST PATH: Direct vector search
      console.log('[ContextProvider] Fast path - direct search');
      memories = await semanticSearch(ctx, userId, userMessage, threshold: 0.7);
    } else {
      // SMART PATH: Rewrite + parallel search
      console.log('[ContextProvider] Smart path - query rewriting');
      
      const rewrites = await rewriteQuery(
        userMessage, 
        recentMessages, 
        previousContext.map(c => c.summary)
      );
      
      const allQueries = [rewrites.original, ...rewrites.variations];
      memories = await parallelSearch(ctx, userId, allQueries, threshold: 0.6);
    }
    
    // 4. Format and store
    if (memories.length > 0) {
      const summary = formatMemoriesForContext(memories);
      await ctx.runMutation(internal.context.storage.storeContext, {
        threadId,
        userId,
        contextType: 'memory',
        summary,
        relevantTo: messageId,
        relevanceScore: memories[0].score,
        ttlMinutes: 5,
        metadata: {
          searchPath: analysis.needsRewrite ? 'smart' : 'fast',
          queryType: analysis.queryType,
          memoriesCount: memories.length
        }
      });
    }
    
    return { 
      success: true, 
      memoriesFound: memories.length,
      searchPath: analysis.needsRewrite ? 'smart' : 'fast'
    };
  }
});
```

**Helper Functions Needed:**
```typescript
async function getRecentMessages(ctx, threadId, limit): Promise<Message[]>
async function getPreviousContext(ctx, threadId, maxAgeMs): Promise<Context[]>
async function semanticSearch(ctx, userId, query, threshold): Promise<SearchResult[]>
function formatMemoriesForContext(memories: SearchResult[]): string
```

**Time:** 45 minutes

---

### **Phase 5: Update Layer 2 Context Handling**
**Goal:** Ensure Layer 2 properly uses the new context format

**Files to modify:**
- `/convex/agents/streamingAgentLoop.ts`

**Changes:**
```typescript
// Current: Falls back to searchMemoriesLimited if no context
// New: Wait for Layer 1 synchronously OR use cached context

// Option A: Make Layer 1 synchronous (wait for it)
const contextSummary = await ctx.runAction(
  internal.workflows.contextProvider.provideContext,
  { threadId, userId, userMessage, messageId: promptMessageId }
);

// Then read from storage
const storedContext = await ctx.runQuery(
  api.context.storage.getContextSummary,
  { threadId, contextTypes: ['memory'] }
);

// Option B: Keep async but add small delay
await new Promise(resolve => setTimeout(resolve, 100)); // Wait 100ms for Layer 1
const contextSummary = await ctx.runQuery(...);

// Fallback only if truly no context
if (!contextSummary) {
  // Use searchMemoriesLimited as last resort
}
```

**Update context injection format:**
```typescript
if (contextSummary) {
  conversationText = `<relevant_memories>
The following are relevant facts from past conversations. Use them naturally when appropriate:

${contextSummary}
</relevant_memories>

User's current message: ${userMessage}`;
}
```

**Time:** 20 minutes

---

### **Phase 6: Testing & Tuning**
**Goal:** Verify system works and tune parameters

**Test Cases:**

1. **Simple query:**
   - Input: "What's my startup about?"
   - Expected: Fast path, relevant memories
   
2. **Follow-up:**
   - Input: "Tell me more about that"
   - Expected: Smart path, NEW memories (not repeat)
   
3. **Conversational:**
   - Input: "What else do you know about me?"
   - Expected: Smart path, diverse memories
   
4. **Multi-concept:**
   - Input: "My startup and funding plans"
   - Expected: Smart path, memories about both topics

**Parameters to Tune:**
- `simpleQueryThreshold`: What word count triggers smart path?
- `semanticThreshold`: 0.6-0.8 range for vector search
- `maxQueryVariations`: 3-5 rewrites
- `maxMemoriesReturned`: 5-10 memories

**Metrics to Track:**
- Fast path usage: ~70-80% of queries
- Smart path usage: ~20-30% of queries
- Average latency: <500ms (fast), <1.2s (smart)
- Repetition rate: Should drop to near 0%
- User satisfaction: Subjective but important

**Time:** 30 minutes

---

## File Structure

```
convex/
├── workflows/
│   ├── contextProvider.ts          [MODIFY - main orchestrator]
│   ├── queryAnalyzer.ts            [NEW - fast vs smart decision]
│   ├── queryRewriter.ts            [NEW - Gemini query expansion]
│   └── parallelSearch.ts           [NEW - multi-query search]
├── agents/
│   └── streamingAgentLoop.ts       [MODIFY - better context usage]
└── context/
    └── storage.ts                   [EXISTS - no changes needed]
```

---

## Dependencies

**Already Have:**
✅ Convex vector search
✅ OpenAI embeddings (text-embedding-3-small)
✅ Memory extraction system
✅ Context storage schema

**Need to Add:**
- Gemini Flash Lite API calls (already configured)
- Query analysis logic
- Parallel promise execution
- Result merging algorithms

**No New External Dependencies Required**

---

## Success Criteria

### Before (Current State):
- ❌ Always returns same 4-5 facts
- ❌ No conversation awareness
- ❌ "Tell me more" gives identical results
- ❌ Poor query understanding

### After (Target State):
- ✅ Returns query-specific memories
- ✅ Understands conversation flow
- ✅ "Tell me more" fetches NEW information
- ✅ Query rewrites improve relevance
- ✅ 70-80% queries use fast path (<200ms)
- ✅ 20-30% queries use smart path (<1.2s)
- ✅ Near-zero repetition within same conversation

---

## Implementation Timeline

**Phase 1:** Query Analyzer - 15 min
**Phase 2:** Query Rewriter - 30 min
**Phase 3:** Parallel Search - 20 min
**Phase 4:** Refactor contextProvider - 45 min
**Phase 5:** Update Layer 2 - 20 min
**Phase 6:** Testing & Tuning - 30 min

**Total Estimated Time: 2.5-3 hours**

---

## Rollout Strategy

### Step 1: Build (Phases 1-5)
Implement all components without breaking existing system.

### Step 2: Test Locally
Use test queries to verify both paths work.

### Step 3: Deploy with Feature Flag
```typescript
const USE_HYBRID_SEARCH = process.env.HYBRID_SEARCH_ENABLED === "true";
```

### Step 4: Monitor
- Track fast vs smart path usage
- Monitor latencies
- Check error rates

### Step 5: Tune & Optimize
- Adjust thresholds based on real usage
- Refine query analysis logic
- Optimize Gemini prompts

### Step 6: Full Rollout
Remove feature flag, make hybrid search default.

---

## Risks & Mitigations

**Risk 1: Increased Latency**
- Mitigation: Fast path handles 70%+ of queries
- Acceptable trade-off for complex queries

**Risk 2: Gemini API Failures**
- Mitigation: Fallback to fast path if rewriter fails
- Graceful degradation

**Risk 3: Too Many API Calls**
- Mitigation: Cache query rewrites for similar questions
- Rate limit smart path usage if needed

**Risk 4: Poor Query Rewrites**
- Mitigation: Log and analyze rewrites
- Tune Gemini prompts based on results

---

## Next Steps

1. ✅ Review and approve this plan
2. 🔄 Begin Phase 1 implementation
3. 🔄 Iteratively build through phases
4. 🔄 Test each phase before moving forward
5. 🔄 Deploy with feature flag
6. 🔄 Monitor and tune

---

**Ready to proceed with implementation?**
