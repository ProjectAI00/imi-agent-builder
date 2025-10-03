import { query } from "../_generated/server";
import { v } from "convex/values";

export const getFullMemoryById = query({
  args: {
    memoryId: v.id("userMemories"),
  },
  handler: async (ctx, { memoryId }) => {
    const memory = await ctx.db.get(memoryId);
    return memory;
  },
});
