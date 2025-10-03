import { query } from "../_generated/server";
import { v } from "convex/values";

export const getRecentMemoriesForUser = query({
  args: {
    userId: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { userId, limit = 5 }) => {
    const memories = await ctx.db
      .query("userMemories")
      .withIndex("by_userId_and_timestamp", (q) => q.eq("userId", userId))
      .order("desc")
      .take(limit);

    return memories.map(m => ({
      _id: m._id,
      threadId: m.threadId,
      timestamp: new Date(m.timestamp).toLocaleString(),
      timestampRaw: m.timestamp,
      minutesAgo: Math.floor((Date.now() - m.timestamp) / 60000),
      priority: m.priority,
      facts: m.facts.slice(0, 5),
      entities: m.entities,
    }));
  },
});
