import { v } from "convex/values";
import { query } from "../_generated/server";
import { components } from "../_generated/api";
import { listUIMessages, syncStreams, vStreamArgs } from "@convex-dev/agent";

/**
 * Message Query Functions
 *
 * These functions retrieve messages from threads
 * They use the Convex Agent component's built-in message system
 */

/**
 * List messages in a thread (with streaming support)
 * This is the main query that the UI will subscribe to
 */
export const list = query({
  args: {
    threadId: v.string(),
    paginationOpts: v.optional(
      v.object({
        numItems: v.number(),
        cursor: v.union(v.string(), v.null()),
      })
    ),
  },
  handler: async (ctx, args) => {
    const { threadId, paginationOpts } = args;

    // Get paginated message list
    const pagination = paginationOpts || {
      numItems: 50,
      cursor: null,
    };

    const messages = await listUIMessages(ctx, components.agent, {
      threadId,
      paginationOpts: pagination,
    });

    return messages;
  },
});

/**
 * Get a single message by ID
 */
export const get = query({
  args: {
    messageId: v.string(),
  },
  handler: async (ctx, args) => {
    // Query the agent component's messages table
    const messages = await ctx.runQuery(
      components.agent.messages.getMessagesByIds,
      {
        messageIds: [args.messageId],
      }
    );

    return messages[0] || null;
  },
});

/**
 * Get streaming messages for a thread
 * Used for real-time updates during generation
 */
export const getStreams = query({
  args: {
    threadId: v.string(),
    streamArgs: vStreamArgs,
  },
  handler: async (ctx, args) => {
    const streams = await syncStreams(ctx, components.agent, {
      threadId: args.threadId,
      streamArgs: args.streamArgs,
    });

    return { streams };
  },
});

/**
 * Count messages in a thread
 */
export const count = query({
  args: {
    threadId: v.string(),
  },
  handler: async (ctx, args) => {
    const metadata = await ctx.db
      .query("threadMetadata")
      .withIndex("by_threadId", (q) => q.eq("threadId", args.threadId))
      .first();

    return metadata?.messageCount || 0;
  },
});