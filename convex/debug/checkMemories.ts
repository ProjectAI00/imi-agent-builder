import { query } from "../_generated/server";

export const listAllMemories = query({
  handler: async (ctx) => {
    const memories = await ctx.db.query("userMemories").collect();
    return memories;
  },
});

export const countMemories = query({
  handler: async (ctx) => {
    const memories = await ctx.db.query("userMemories").collect();
    return {
      total: memories.length,
      byDeleted: {
        active: memories.filter(m => !m.deleted).length,
        deleted: memories.filter(m => m.deleted).length
      }
    };
  },
});
