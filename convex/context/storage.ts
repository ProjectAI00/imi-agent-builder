import { v } from "convex/values";
import { mutation, query, internalMutation } from "../_generated/server";

/**
 * Store context provided by contextAgent
 */
export const storeContext = internalMutation({
  args: {
    threadId: v.string(),
    userId: v.string(),
    contextType: v.string(),
    summary: v.string(),
    relevantTo: v.optional(v.string()),
    rawData: v.optional(v.any()),
    relevanceScore: v.optional(v.number()),
    ttlMinutes: v.optional(v.number()), // Time-to-live in minutes (default: 5)
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const ttl = args.ttlMinutes || 5;
    const expiresAt = now + (ttl * 60 * 1000);

    const contextId = await ctx.db.insert("threadContext", {
      threadId: args.threadId,
      userId: args.userId,
      contextType: args.contextType,
      summary: args.summary,
      relevantTo: args.relevantTo,
      rawData: args.rawData,
      relevanceScore: args.relevanceScore || 0.5,
      createdAt: now,
      expiresAt,
    });

    return { contextId, expiresAt };
  },
});

/**
 * Get recent context for a thread
 */
export const getRecentContext = query({
  args: {
    threadId: v.string(),
    contextTypes: v.optional(v.array(v.string())),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    // Get all non-expired context for this thread
    let contexts = await ctx.db
      .query("threadContext")
      .withIndex("by_threadId", (q) => q.eq("threadId", args.threadId))
      .filter((q) => q.gte(q.field("expiresAt"), now))
      .collect();

    // Filter by context types if specified
    if (args.contextTypes && args.contextTypes.length > 0) {
      contexts = contexts.filter((c) => args.contextTypes!.includes(c.contextType));
    }

    // Sort by relevance score (highest first) and creation time (newest first)
    contexts.sort((a, b) => {
      const scoreDiff = (b.relevanceScore || 0) - (a.relevanceScore || 0);
      if (scoreDiff !== 0) return scoreDiff;
      return b.createdAt - a.createdAt;
    });

    // Limit results if specified
    if (args.limit) {
      contexts = contexts.slice(0, args.limit);
    }

    return contexts;
  },
});

/**
 * Get formatted context summary for imiAgent
 * Returns a single string with all recent context
 */
export const getContextSummary = query({
  args: {
    threadId: v.string(),
    contextTypes: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const contexts = await ctx.db
      .query("threadContext")
      .withIndex("by_threadId", (q) => q.eq("threadId", args.threadId))
      .filter((q) => q.gte(q.field("expiresAt"), Date.now()))
      .collect();

    if (contexts.length === 0) {
      return null;
    }

    // Filter by type if specified
    let filteredContexts = contexts;
    if (args.contextTypes && args.contextTypes.length > 0) {
      filteredContexts = contexts.filter((c) => args.contextTypes!.includes(c.contextType));
    }

    // Sort by relevance
    filteredContexts.sort((a, b) => {
      const scoreDiff = (b.relevanceScore || 0) - (a.relevanceScore || 0);
      if (scoreDiff !== 0) return scoreDiff;
      return b.createdAt - a.createdAt;
    });

    // Build formatted summary
    const summaries: string[] = [];

    for (const context of filteredContexts) {
      const typeLabel = context.contextType.toUpperCase();
      summaries.push(`[${typeLabel}] ${context.summary}`);
    }

    return summaries.join("\n\n");
  },
});

/**
 * Determine whether fresh context already exists for a thread or message
 */
export const hasFreshContext = query({
  args: {
    threadId: v.string(),
    messageId: v.optional(v.string()),
    maxAgeMs: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const maxAge = args.maxAgeMs ?? 90_000; // default 90s freshness window
    const lowerBound = now - maxAge;

    const contexts = await ctx.db
      .query("threadContext")
      .withIndex("by_threadId", (q) => q.eq("threadId", args.threadId))
      .filter((q) => q.gte(q.field("createdAt"), lowerBound))
      .collect();

    if (contexts.length === 0) {
      return false;
    }

    if (!args.messageId) {
      return true;
    }

    return contexts.some((context) => context.relevantTo === args.messageId);
  },
});

/**
 * Clean up expired context (can be called periodically)
 */
export const cleanupExpiredContext = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();

    const expired = await ctx.db
      .query("threadContext")
      .withIndex("by_expiresAt")
      .filter((q) => q.lt(q.field("expiresAt"), now))
      .collect();

    for (const context of expired) {
      await ctx.db.delete(context._id);
    }

    return { deleted: expired.length };
  },
});

/**
 * Delete all context for a thread (useful for privacy/cleanup)
 */
export const clearThreadContext = mutation({
  args: {
    threadId: v.string(),
  },
  handler: async (ctx, args) => {
    const contexts = await ctx.db
      .query("threadContext")
      .withIndex("by_threadId", (q) => q.eq("threadId", args.threadId))
      .collect();

    for (const context of contexts) {
      await ctx.db.delete(context._id);
    }

    return { deleted: contexts.length };
  },
});
