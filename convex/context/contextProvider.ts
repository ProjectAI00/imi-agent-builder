import { internalAction } from "../_generated/server";
import { v } from "convex/values";
import { internal, api, components } from "../_generated/api";
import { analyzeQuery, estimateLatency } from "./queryAnalyzer";
import { rewriteQuery } from "./queryRewriter";
import { parallelSearch, formatResultsForContext } from "./parallelSearch";

/**
 * Hybrid Context Provider - Supermemory-inspired architecture
 *
 * Two search paths:
 * - Fast path: Direct vector search for simple queries (~150ms)
 * - Smart path: Query rewriting + parallel search for complex queries (~1s)
 *
 * Provides conversation-aware, intelligent memory retrieval.
 */

/**
 * Main entry point - Hybrid search strategy
 */
export const provideContext = internalAction({
  args: {
    threadId: v.string(),
    userId: v.string(),
    userMessage: v.string(),
    messageId: v.string(),
  },
  handler: async (ctx, args) => {
    const { threadId, userId, userMessage, messageId } = args;
    const startTime = Date.now();

    console.log(`[ContextProvider] Processing: "${userMessage.substring(0, 50)}..."`);

    try {
      // Check for fresh context
      const alreadyFresh = await ctx.runQuery(api.context.storage.hasFreshContext, {
        threadId,
        messageId,
        maxAgeMs: 60_000, // 60s freshness window
      });

      if (alreadyFresh) {
        console.log(`[ContextProvider] Using cached context`);
        return { success: true, cached: true, searchPath: 'cached' };
      }

      // Get recent conversation history
      const recentMessages = await getRecentMessages(ctx, threadId, 5);
      
      // Get previously fetched context (to avoid repetition)
      const previousContext = await getPreviousContext(ctx, threadId, 120_000); // 2 min window

      // ALWAYS USE SMART PATH - Query rewriting + parallel search
      const searchPath = 'smart';
      console.log(`[ContextProvider] 🧠 Smart path - query rewriting (forced)`);
      
      const rewrites = await rewriteQuery(
        userMessage,
        recentMessages,
        previousContext.map(c => c.summary)
      );
      
      console.log(`[ContextProvider] Generated ${rewrites.variations.length} query variations`);
      console.log(`[ContextProvider] Strategy: ${rewrites.strategy}, Reasoning: ${rewrites.reasoning}`);
      
      const allQueries = [rewrites.original, ...rewrites.variations];
      
      const searchResults = await parallelSearch(ctx, userId, allQueries, {
        threshold: 0.6, // Lower threshold for more recall
        maxResults: 10,
        boostDiversity: true,
      });

      // Format and store results
      if (searchResults.results.length > 0) {
        const summary = formatResultsForContext(searchResults.results);
        const topScore = searchResults.results[0]?.score || 0.5;
        
        await ctx.runMutation(internal.context.storage.storeContext, {
          threadId,
          userId,
          contextType: 'memory',
          summary,
          relevantTo: messageId,
          relevanceScore: topScore,
          ttlMinutes: 3, // 3 min TTL
          rawData: {
            searchPath,
            memoriesCount: searchResults.results.length,
            duplicatesRemoved: searchResults.duplicatesRemoved,
            searchLatencyMs: searchResults.searchLatencyMs,
            queryVariations: allQueries.length,
          },
        });
        
        const totalTime = Date.now() - startTime;
        console.log(`[ContextProvider] ✅ Stored ${searchResults.results.length} memories (smart path, ${totalTime}ms total)`);
        
        return {
          success: true,
          memoriesFound: searchResults.results.length,
          searchPath: 'smart',
          latencyMs: totalTime,
        };
      } else {
        console.log(`[ContextProvider] ⚠️ No relevant memories found`);
        return {
          success: true,
          memoriesFound: 0,
          searchPath: 'smart',
        };
      }
      
    } catch (error) {
      console.error("[ContextProvider] Error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },
});

/**
 * Helper: Get recent messages from thread
 */
async function getRecentMessages(
  ctx: any,
  threadId: string,
  limit: number
): Promise<Array<{ role: 'user' | 'assistant'; content: string }>> {
  try {
    const result = await ctx.runQuery(api.chat.messages.list, {
      threadId,
      paginationOpts: {
        numItems: limit,
        cursor: null,
      },
    });

    return result.page
      .filter((m: any) => m.message?.role && m.message?.content)
      .map((m: any) => ({
        role: m.message.role === 'user' ? 'user' : 'assistant',
        content: String(m.message.content).substring(0, 500), // Limit length
      }))
      .reverse(); // Oldest first
  } catch (error) {
    console.warn('[ContextProvider] Could not fetch recent messages:', error);
    return [];
  }
}

/**
 * Helper: Get previously fetched context to avoid repetition
 */
async function getPreviousContext(
  ctx: any,
  threadId: string,
  maxAgeMs: number
): Promise<Array<{ summary: string; contextType: string }>> {
  try {
    const now = Date.now();
    const minCreatedAt = now - maxAgeMs;

    const contexts = await ctx.runQuery(api.context.storage.getRecentContext, {
      threadId,
      contextTypes: ['memory'],
      limit: 10,
    });

    return contexts
      .filter((c: any) => c.createdAt >= minCreatedAt)
      .map((c: any) => ({
        summary: c.summary,
        contextType: c.contextType,
      }));
  } catch (error) {
    console.warn('[ContextProvider] Could not fetch previous context:', error);
    return [];
  }
}
