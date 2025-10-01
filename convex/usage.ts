import { internalMutation } from "./_generated/server";
import { v } from "convex/values";

/**
 * Internal mutation to log agent usage
 * Called by the agent's usageHandler
 */
export const logUsage = internalMutation({
  args: {
    userId: v.string(),
    agentName: v.string(),
    model: v.string(),
    provider: v.string(),
    promptTokens: v.number(),
    completionTokens: v.number(),
    totalTokens: v.number(),
    estimatedCost: v.number(),
    timestamp: v.number(),
    threadId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("usage", args);
  },
});