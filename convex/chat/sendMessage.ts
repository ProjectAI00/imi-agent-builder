import { v } from "convex/values";
import { action, internalAction, internalMutation } from "../_generated/server";
import { internal } from "../_generated/api";
import { getAgent } from "../agents/index";

/**
 * Send Message and Generate Response
 *
 * This action:
 * 1. Saves the user's message
 * 2. Schedules the AI response generation
 * 3. Returns immediately for fast UI feedback
 */
export const send = action({
  args: {
    threadId: v.string(),
    prompt: v.string(),
    userId: v.optional(v.string()),
    agentType: v.optional(v.union(v.literal("casual"), v.literal("roast"))),
    skipResponse: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { threadId, prompt, userId = "anonymous", agentType = "casual", skipResponse } = args;

    // Get agent based on type
    const agent = getAgent(agentType);

    // Save the user's message
    const { messageId } = await agent.saveMessage(ctx, {
      threadId,
      prompt,
      skipEmbeddings: true,
    });

    // Skip scheduling for internal/system notes or when explicitly requested
    const isSystemNote = prompt.trim().startsWith("[SYSTEM:");
    if (!skipResponse && !isSystemNote) {
      await ctx.scheduler.runAfter(0, internal.chat.sendMessage.generateResponse, {
        threadId,
        promptMessageId: messageId,
        userId,
        agentType,
      });
    }

    return {
      messageId,
      threadId,
    };
  },
});

/**
 * Internal action to generate the AI response
 * This runs asynchronously after send() returns
 */
export const generateResponse = internalAction({
  args: {
    threadId: v.string(),
    promptMessageId: v.string(),
    userId: v.string(),
    agentType: v.optional(v.union(v.literal("casual"), v.literal("roast"))),
  },
  handler: async (ctx, args) => {
    const { threadId, promptMessageId, userId, agentType = "casual" } = args;

    try {
      // Get agent based on type
      const agent = getAgent(agentType);

      // Generate response with streaming
      const result = await agent.streamText(
        ctx,
        { threadId, userId },
        { promptMessageId },
        {
          // Save stream deltas for real-time UI updates
          saveStreamDeltas: {
            chunking: "word",
            throttleMs: 100,
          },
        }
      );

      // Consume the stream (required to complete)
      await result.consumeStream();

      console.log(`[Generate Response] Completed for thread ${threadId}`);

    } catch (error) {
      console.error("[Generate Response] Error:", error);

      // Log error to database
      await ctx.runMutation(internal.chat.sendMessage.logError, {
        threadId,
        promptMessageId,
        error: error instanceof Error ? error.message : "Unknown error",
      });

      throw error;
    }
  },
});

/**
 * Log generation errors
 */
export const logError = internalMutation({
  args: {
    threadId: v.string(),
    promptMessageId: v.string(),
    error: v.string(),
  },
  handler: async (ctx, args) => {
    // You could save this to a dedicated errors table
    console.error(`[Error Log] Thread: ${args.threadId}, Message: ${args.promptMessageId}, Error: ${args.error}`);
  },
});