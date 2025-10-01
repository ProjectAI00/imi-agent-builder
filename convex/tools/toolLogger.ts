import { internalMutation } from "../_generated/server";
import { v } from "convex/values";

/**
 * Internal mutation to log tool executions
 * Used for analytics, debugging, and monitoring
 */
export const logToolExecution = internalMutation({
  args: {
    toolName: v.string(),
    userId: v.string(),
    threadId: v.string(),
    args: v.string(), // JSON string
    success: v.boolean(),
    error: v.optional(v.string()),
    executionTime: v.number(),
    timestamp: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("toolLogs", args);
  },
});