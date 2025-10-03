import { internalAction, internalQuery } from "../_generated/server";
import { internal } from "../_generated/api";

/**
 * Get all threads that need memory extraction
 */
export const getAllThreadsNeedingMemories = internalQuery({
  handler: async (ctx) => {
    const threads = await ctx.db.query("threadMetadata").collect();
    return threads;
  },
});

/**
 * Backfill memories for all existing threads
 * Run this once to extract memories from past conversations
 */
export const backfillAllMemories = internalAction({
  handler: async (ctx) => {
    console.log("[Backfill] Starting memory extraction for all threads...");

    // Get all threads
    const threads = await ctx.runQuery(internal.debug.backfillMemories.getAllThreadsNeedingMemories);

    console.log(`[Backfill] Found ${threads.length} threads to process`);

    let successCount = 0;
    let errorCount = 0;

    // Extract memories from each thread
    for (const thread of threads) {
      try {
        console.log(`[Backfill] Processing thread ${thread.threadId} for user ${thread.userId}`);

        await ctx.runAction(internal.memory.extractMemories.extractFromThread, {
          threadId: thread.threadId,
          userId: thread.userId,
        });

        successCount++;
        console.log(`[Backfill] ✓ Success (${successCount}/${threads.length})`);
      } catch (error) {
        errorCount++;
        console.error(`[Backfill] ✗ Failed for thread ${thread.threadId}:`, error);
      }
    }

    const result = {
      total: threads.length,
      success: successCount,
      errors: errorCount,
    };

    console.log("[Backfill] Complete:", result);
    return result;
  },
});
