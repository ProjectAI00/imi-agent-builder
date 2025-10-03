import { query } from "../_generated/server";
import { v } from "convex/values";

export const getMemoriesForUser = query({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, { userId }) => {
    const memories = await ctx.db
      .query("userMemories")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .filter((q) => q.eq(q.field("deleted"), false))
      .collect();

    return {
      userId,
      totalMemories: memories.length,
      memories: memories.map(m => ({
        _id: m._id,
        threadId: m.threadId,
        timestamp: new Date(m.timestamp).toLocaleString(),
        priority: m.priority,
        entities: m.entities,
        facts: m.facts,
        messageCount: m.messageIds.length,
      }))
    };
  },
});
