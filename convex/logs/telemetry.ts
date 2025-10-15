import { v } from "convex/values";
import { internalMutation } from "../_generated/server";

export const recordToolExecution = internalMutation({
  args: {
    userId: v.string(),
    threadId: v.string(),
    toolName: v.string(),
    success: v.boolean(),
    durationMs: v.optional(v.number()),
    jobId: v.optional(v.string()),
    error: v.optional(v.string()),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    try {
      await ctx.db.insert("toolLogs", {
        toolName: args.toolName,
        userId: args.userId,
        threadId: args.threadId,
        args: args.metadata ? JSON.stringify(args.metadata) : "{}",
        success: args.success,
        error: args.error,
        executionTime: args.durationMs ?? 0,
        timestamp: Date.now(),
      });
    } catch (error) {
      console.error("[Telemetry] Failed to record tool log", error);
    }
  },
});
