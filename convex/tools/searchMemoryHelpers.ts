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
