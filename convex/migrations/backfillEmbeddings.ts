import { action, internalQuery } from "../_generated/server";
import { components } from "../_generated/api";
import { createOpenAI } from "@ai-sdk/openai";
import { embed } from "ai";
import { internal } from "../_generated/api";

const openai = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

/**
 * Get all threads
 */
export const getAllThreads = internalQuery({
  handler: async (ctx) => {
    const threads = await ctx.db.query("threadMetadata").collect();
    return threads.map(t => t.threadId);
  },
});

/**
 * Backfill embeddings for all existing messages
 * Run with: npx convex run migrations:backfillEmbeddings
 */
export const backfillEmbeddings = action({
  handler: async (ctx): Promise<{ threads: number; processed: number; skipped: number; failed: number }> => {
    console.log("Starting backfill...");

    // Get all thread IDs
    const threadIds: string[] = await ctx.runQuery(internal.migrations.backfillEmbeddings.getAllThreads);
    console.log(`Found ${threadIds.length} threads`);

    let totalProcessed = 0;
    let totalSkipped = 0;
    let totalFailed = 0;

    for (const threadId of threadIds) {
      try {
        // Get messages for this thread
        const result = await ctx.runQuery(components.agent.messages.listMessagesByThreadId, {
          threadId,
          order: "asc" as const,
        });

        for (const message of result.page) {
          try {
            // Skip if no text
            if (!message.text || message.text.trim() === "") {
              totalSkipped++;
              continue;
            }

            // Generate embedding
            const { embedding } = await embed({
              model: openai.embedding("text-embedding-3-small"),
              value: message.text,
            });

            // Store via component
            await ctx.runMutation(components.agent.vector.index.insertBatch, {
              vectorDimension: 1536,
              vectors: [{
                model: "text-embedding-3-small",
                table: "messages",
                vector: embedding,
                messageId: message._id,
                threadId: message.threadId,
                userId: message.userId,
              }],
            });

            totalProcessed++;

            if (totalProcessed % 10 === 0) {
              console.log(`Processed ${totalProcessed} messages...`);
            }

          } catch (error) {
            console.error(`Failed message ${message._id}:`, error);
            totalFailed++;
          }
        }

      } catch (error) {
        console.error(`Failed thread ${threadId}:`, error);
        totalFailed++;
      }
    }

    const finalResult = {
      threads: threadIds.length,
      processed: totalProcessed,
      skipped: totalSkipped,
      failed: totalFailed,
    };

    console.log("Backfill complete:", finalResult);
    return finalResult;
  },
});
