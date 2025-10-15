import { v } from "convex/values";
import { action } from "../_generated/server";
import { searchMemoryHandler } from "../tools/searchMemory";

/**
 * Bridge action to expose existing searchMemory tool handler
 * for external orchestrators (e.g., Claude Agent SDK) via Convex HTTP client.
 */
export const run = action({
  args: { userId: v.string(), query: v.string() },
  handler: async (ctx, args) => {
    const { userId, query } = args;

    // Reuse the tool handler directly to keep behavior consistent
    const result = await searchMemoryHandler(
      { ...ctx, userId } as any,
      { query }
    );

    return result;
  },
});

