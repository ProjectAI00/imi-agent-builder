import { mutation, query } from "../_generated/server";
import { v } from "convex/values";

export const create = mutation({
  args: {
    userId: v.string(),
    sessionId: v.string(),
    workerId: v.string(),
    taskType: v.string(),
    status: v.string(),
    startedAt: v.number(),
    completedAt: v.optional(v.number()),
    toolsCalled: v.array(v.string()),
    results: v.any(),
    error: v.optional(v.string()),
    userNotified: v.boolean(),
    notificationMessage: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("backgroundTasks", args);
  },
});

export const getRecentByUser = query({
  args: {
    userId: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit || 10;
    
    return await ctx.db
      .query("backgroundTasks")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .order("desc")
      .take(limit);
  },
});

export const markNotified = mutation({
  args: {
    taskId: v.id("backgroundTasks"),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.taskId, {
      userNotified: true,
    });
  },
});
