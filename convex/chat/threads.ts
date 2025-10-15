import { v } from "convex/values";
import { mutation, query, action, internalMutation } from "../_generated/server";
import { createThread as createAgentThread } from "@convex-dev/agent";
import { components, internal } from "../_generated/api";

/**
 * Thread Management Functions
 *
 * These functions handle creating, retrieving, and managing conversation threads
 * They integrate with the Convex Agent component's built-in thread system
 */

/**
 * Create a new thread for a user (internal mutation)
 */
export const createInternal = internalMutation({
  args: {
    userId: v.string(),
    title: v.optional(v.string()),
    contextKey: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { userId, title, contextKey } = args;

    // Create thread in Agent component
    const threadId = await createAgentThread(ctx, components.agent, {
      userId,
      title,
      summary: contextKey,
    });

    // Create our custom metadata entry
    await ctx.db.insert("threadMetadata", {
      threadId,
      userId,
      title,
      contextKey,
      messageCount: 0,
      lastMessageAt: Date.now(),
      createdAt: Date.now(),
    });

    return { threadId };
  },
});

/**
 * Create a new thread for a user
 */
export const create = action({
  args: {
    userId: v.string(),
    title: v.optional(v.string()),
    contextKey: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<{ threadId: string }> => {
    const { userId, title, contextKey } = args;

    // Create the thread
    const result: { threadId: string } = await ctx.runMutation(internal.chat.threads.createInternal, {
      userId,
      title,
      contextKey,
    });

    return result;
  },
});

/**
 * Get a thread by ID
 */
export const get = query({
  args: {
    threadId: v.string(),
  },
  handler: async (ctx, args) => {
    const metadata = await ctx.db
      .query("threadMetadata")
      .withIndex("by_threadId", (q) => q.eq("threadId", args.threadId))
      .first();

    return metadata;
  },
});

/**
 * List threads for a user (paginated)
 */
export const list = query({
  args: {
    userId: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { userId, limit = 50 } = args;

    const threads = await ctx.db
      .query("threadMetadata")
      .withIndex("by_userId_and_lastMessage", (q) => q.eq("userId", userId))
      .order("desc")
      .take(limit);

    return threads;
  },
});

/**
 * Update thread metadata
 */
export const update = mutation({
  args: {
    threadId: v.string(),
    title: v.optional(v.string()),
    summary: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { threadId, title, summary } = args;

    const metadata = await ctx.db
      .query("threadMetadata")
      .withIndex("by_threadId", (q) => q.eq("threadId", threadId))
      .first();

    if (!metadata) {
      throw new Error("Thread not found");
    }

    await ctx.db.patch(metadata._id, {
      ...(title !== undefined && { title }),
      ...(summary !== undefined && { summary }),
    });
  },
});

/**
 * Increment message count for a thread
 */
export const incrementMessageCount = mutation({
  args: {
    threadId: v.string(),
  },
  handler: async (ctx, args) => {
    const metadata = await ctx.db
      .query("threadMetadata")
      .withIndex("by_threadId", (q) => q.eq("threadId", args.threadId))
      .first();

    if (metadata) {
      await ctx.db.patch(metadata._id, {
        messageCount: metadata.messageCount + 1,
        lastMessageAt: Date.now(),
      });
    }
  },
});

/**
 * Delete a thread
 */
export const deleteThread = mutation({
  args: {
    threadId: v.string(),
  },
  handler: async (ctx, args) => {
    // Delete metadata
    const metadata = await ctx.db
      .query("threadMetadata")
      .withIndex("by_threadId", (q) => q.eq("threadId", args.threadId))
      .first();

    if (metadata) {
      await ctx.db.delete(metadata._id);
    }

    // Note: Agent component thread deletion is handled separately
    // You would call components.agent.threads.delete here if needed
  },
});

/**
 * Get or create a thread for a user
 * Useful for iMessage integration where we want one thread per phone number
 */
export const getOrCreate = mutation({
  args: {
    userId: v.string(),
    contextKey: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { userId, contextKey } = args;

    // Try to find existing thread with this contextKey
    if (contextKey) {
      const existing = await ctx.db
        .query("threadMetadata")
        .filter((q) =>
          q.and(
            q.eq(q.field("userId"), userId),
            q.eq(q.field("contextKey"), contextKey)
          )
        )
        .first();

      if (existing) {
        return { threadId: existing.threadId, isNew: false };
      }
    }

    // Create new thread
    const threadId = await createAgentThread(ctx, components.agent, {
      userId,
      summary: contextKey,
    });

    await ctx.db.insert("threadMetadata", {
      threadId,
      userId,
      contextKey,
      messageCount: 0,
      lastMessageAt: Date.now(),
      createdAt: Date.now(),
    });

    return { threadId, isNew: true };
  },
});