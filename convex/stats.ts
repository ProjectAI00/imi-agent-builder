import { query } from "./_generated/server";

/**
 * Database statistics queries
 */

export const countUsers = query({
  handler: async (ctx) => {
    const users = await ctx.db.query("authUsers").collect();
    return { count: users.length };
  },
});

export const countThreads = query({
  handler: async (ctx) => {
    const threads = await ctx.db.query("threadMetadata").collect();
    return { count: threads.length };
  },
});
