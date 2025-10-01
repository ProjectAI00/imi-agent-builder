import { v } from "convex/values";
import { action, internalAction } from "../_generated/server";
import { internal } from "../_generated/api";
import { getAgent } from "../agents/index";

/**
 * Initialize Roast Thread
 *
 * This internal action triggers the AI to send the first roasting message
 * when a new thread is created for the roast agent.
 */
export const initializeRoast = internalAction({
  args: {
    threadId: v.string(),
    userId: v.string(), // This is the Twitter username
  },
  handler: async (ctx, args) => {
    const { threadId, userId } = args;

    console.log(`[Init Roast] Starting for user: ${userId}, thread: ${threadId}`);

    // Get roast agent
    const agent = getAgent("roast");

    // Create a system prompt that triggers the roast with user context
    const initPrompt = `[SYSTEM: New user "${userId}" just logged in. You're going to do a background 
     check on the user where you are going to find their information out of their description, 
     their latest post, and posting history to understand who they are, what they're working on,
     and what they're posting about. You will figure out their personality, what they care about,
     and what they don't care about. You will analyze their character, what they're interested in. 
    history and tweet history.]`;

    // Save the init message (hidden from user)
    const { messageId } = await agent.saveMessage(ctx, {
      threadId,
      prompt: initPrompt,
      skipEmbeddings: true,
    });

    // Schedule async response generation
    await ctx.scheduler.runAfter(0, internal.chat.sendMessage.generateResponse, {
      threadId,
      promptMessageId: messageId,
      userId,
      agentType: "roast" as const,
    });

    console.log(`[Init Roast] Scheduled roast generation for ${userId}`);

    return {
      messageId,
      threadId,
    };
  },
});
