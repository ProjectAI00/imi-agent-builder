import { mutation, query } from "../_generated/server";
import { v } from "convex/values";

export const create = mutation({
  args: {
    userId: v.string(),
    sessionId: v.string(),
    sessionUrl: v.string(),
    connectedToolkits: v.array(v.string()),
    createdAt: v.number(),
    lastActiveAt: v.number(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("toolRouterSessions")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        sessionId: args.sessionId,
        sessionUrl: args.sessionUrl,
        connectedToolkits: args.connectedToolkits,
        lastActiveAt: args.lastActiveAt,
      });
      return existing._id;
    }

    const sessionId = await ctx.db.insert("toolRouterSessions", {
      ...args,
      backgroundWorkers: [],
    });

    return sessionId;
  },
});

export const getByUserId = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("toolRouterSessions")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .first();
  },
});

export const updateToolkits = mutation({
  args: {
    userId: v.string(),
    toolkits: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db
      .query("toolRouterSessions")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .first();

    if (!session) {
      throw new Error("Session not found");
    }

    await ctx.db.patch(session._id, {
      connectedToolkits: args.toolkits,
      lastActiveAt: Date.now(),
    });

    return { success: true };
  },
});

export const updateWorkerConfig = mutation({
  args: {
    userId: v.string(),
    workerId: v.string(),
    enabled: v.boolean(),
    config: v.any(),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db
      .query("toolRouterSessions")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .first();

    if (!session) {
      throw new Error("Session not found");
    }

    const workers = session.backgroundWorkers || [];
    const workerIndex = workers.findIndex((w) => w.id === args.workerId);

    if (workerIndex === -1) {
      throw new Error("Worker not found");
    }

    workers[workerIndex] = {
      ...workers[workerIndex],
      enabled: args.enabled,
      config: args.config,
    };

    await ctx.db.patch(session._id, {
      backgroundWorkers: workers,
    });

    return { success: true };
  },
});

export const deleteByUserId = mutation({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db
      .query("toolRouterSessions")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .first();

    if (!session) {
      return { success: false, message: "No session found for this user" };
    }

    await ctx.db.delete(session._id);

    return {
      success: true,
      message: "Session deleted successfully. A new session will be created on next use.",
      deletedSessionId: session.sessionId,
    };
  },
});
