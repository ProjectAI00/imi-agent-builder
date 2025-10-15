import { v } from "convex/values";
import { action } from "../_generated/server";
import { searchTwitterHandler } from "../tools/searchTwitter";

/**
 * Bridge action to expose existing searchTwitter tool handler
 * for external orchestrators (e.g., Claude Agent SDK) via Convex HTTP client.
 */
export const run = action({
  args: { userId: v.string(), query: v.string(), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const { userId, query, limit = 20 } = args;

    const result = await searchTwitterHandler(
      { ...ctx, userId } as any,
      { query, limit }
    );

    return result;
  },
});

