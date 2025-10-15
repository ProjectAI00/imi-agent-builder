import { internalAction } from "../_generated/server";
import { v } from "convex/values";
import { internal, api } from "../_generated/api";

/**
 * Unified Agent Router
 *
 * Single entry point for user-turn orchestration:
 * - Opportunistically schedules context fetch (async, cached)
 * - Prefers streaming agent path
 * - Falls back to legacy/Claude if configured
 */
export const route = internalAction({
  args: {
    threadId: v.string(),
    promptMessageId: v.string(),
    userId: v.string(),
    userMessage: v.string(),
  },
  handler: async (ctx, { threadId, promptMessageId, userId, userMessage }) => {
    try {
      // Lightweight triviality check to avoid unnecessary background fetches
      const isTrivial = (() => {
        const t = (userMessage || "").trim();
        if (t.length === 0) return true;
        if (t.length <= 24 && /^(hi|hey|hello|yo|sup|ping|test)\b/i.test(t)) return true;
        const keywords = /(@|\bremember\b|\bsummary\b|\bsearch\b|\bemail\b|\bnotion\b|\bslack\b|\btwitter\b|\broast\b|\bplan\b|\bfind\b|\blook up\b)/i;
        return t.length < 120 && !keywords.test(t);
      })();

      // Always run Layer 1 synchronously (hybrid search is fast enough)
      // Fast path: ~150ms, Smart path: ~1s
      try {
        console.log('[Router] Running Layer 1 context fetch...');
        const contextResult = await ctx.runAction(internal.context.contextProvider.provideContext, {
          threadId,
          userId,
          userMessage,
          messageId: promptMessageId,
        });
        console.log(`[Router] Layer 1 completed: ${contextResult.searchPath || 'cached'} path, ${contextResult.memoriesFound || 0} memories`);
      } catch (e) {
        console.warn("[Router] Layer 1 failed, continuing without context:", e);
        // Continue anyway - Layer 2 will work without context
      }

      // Primary: event-streaming agent loop (default to enabled unless explicitly disabled)
      const streamingEnabled = process.env.STREAMING_AGENT_ENABLED !== "false";
      if (streamingEnabled) {
        try {
          await ctx.runAction(internal.agents.streamingAgentAction.streamAgentResponse, {
            threadId,
            userId,
            userMessage,
            promptMessageId,
            maxIterations: 10,
          });
          return { routed: "streaming" } as const;
        } catch (e) {
          console.warn("[Router] Streaming path failed, falling back", e);
        }
      }

      // Optional Claude HTTP orchestrator
      if (process.env.CLAUDE_AGENT_ENABLED === "true") {
        try {
          await ctx.runAction(internal.chat.sendMessage.generateClaudeResponse, {
            threadId,
            promptMessageId,
            userId,
            userMessage,
          });
          return { routed: "claude" } as const;
        } catch (e) {
          console.warn("[Router] Claude path failed", e);
          throw new Error("All routing paths failed");
        }
      }

      // No streaming or Claude enabled - error
      throw new Error("No agent routing enabled. Set STREAMING_AGENT_ENABLED=true or CLAUDE_AGENT_ENABLED=true");
    } catch (error) {
      console.error("[Router] Error:", error);
      throw error;
    }
  },
});
