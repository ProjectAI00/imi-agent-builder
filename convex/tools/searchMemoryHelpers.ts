import { internalQuery } from "../_generated/server";
import { v } from "convex/values";

/**
 * Get all non-deleted memories for a user
 */
export const getUserMemories = internalQuery({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, { userId }) => {
    const memories = await ctx.db
      .query("userMemories")
      .withIndex("by_userId_and_deleted", (q) =>
        q.eq("userId", userId).eq("deleted", false)
      )
      .collect();

    return memories;
  },
});

/**
 * Search memories with limit to prevent context overflow
 * Returns only the most recent relevant memories
 */
export const searchMemoriesLimited = internalQuery({
  args: {
    userId: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { userId, limit = 5 }) => {
    const memories = await ctx.db
      .query("userMemories")
      .withIndex("by_userId_and_deleted", (q) =>
        q.eq("userId", userId).eq("deleted", false)
      )
      .order("desc") // Most recent first
      .take(limit);

    return memories;
  },
});
