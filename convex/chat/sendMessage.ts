import { v } from "convex/values";
import { action, internalAction, internalMutation } from "../_generated/server";
import { internal, components } from "../_generated/api";

/**
 * Send Message and Generate Response
 *
 * This action:
 * 1. Saves the user's message
 * 2. Schedules the AI response generation via router
 * 3. Returns immediately for fast UI feedback
 */
export const send = action({
  args: {
    threadId: v.string(),
    prompt: v.string(),
    userId: v.optional(v.string()),
    skipResponse: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { threadId, prompt, userId = "anonymous", skipResponse } = args;

    // Save the user's message directly (no agent needed)
    const messages = await ctx.runMutation(components.agent.messages.addMessages as any, {
      threadId,
      userId,
      messages: [
        {
          message: {
            role: "user",
            content: prompt,
          },
          text: prompt,
        },
      ],
    });

    const messageId = messages.messages[0]?._id as string;

    // Skip scheduling for internal/system notes or when explicitly requested
    const isSystemNote = prompt.trim().startsWith("[SYSTEM:");
    if (!skipResponse && !isSystemNote) {
      await ctx.scheduler.runAfter(0, internal.agents.router.route, {
        threadId,
        promptMessageId: messageId,
        userId,
        userMessage: prompt,
      });
    }

    // Schedule memory extraction after 2 minutes of inactivity
    await ctx.scheduler.runAfter(120000, internal.memory.extractMemories.extractFromThread, {
      threadId,
      userId,
    });

    return {
      messageId,
      threadId,
    };
  },
});

// Router now lives at internal.agents.router.route
// All message handling goes through streamingAgentAction

/**
 * Call the Claude orchestrator HTTP endpoint and append the assistant message.
 */
export const generateClaudeResponse = internalAction({
  args: {
    threadId: v.string(),
    promptMessageId: v.string(),
    userId: v.string(),
    userMessage: v.string(),
  },
  handler: async (ctx, args) => {
    const { threadId, userId, userMessage } = args;

    const base =
      process.env.ORCHESTRATOR_URL ||
      process.env.NEXT_PUBLIC_APP_URL ||
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

    const url = `${base.replace(/\/$/, "")}/api/orchestrate/claude`;

    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ threadId, userId, userMessage }),
    });

    if (!resp.ok) {
      const text = await resp.text().catch(() => "");
      throw new Error(`Orchestrator error: ${resp.status} ${text}`);
    }

    const data = (await resp.json()) as any;
    const assistantText = (data && (data.text || data.result || "")).toString();

    if (!assistantText) return;

    await ctx.runMutation(components.agent.messages.addMessages as any, {
      threadId,
      messages: [
        {
          message: {
            role: "assistant",
            content: assistantText,
          },
          text: assistantText,
          status: "success",
          finishReason: "stop",
        },
      ],
    } as any);
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
  handler: async (_ctx, args) => {
    // You could save this to a dedicated errors table
    console.error(`[Error Log] Thread: ${args.threadId}, Message: ${args.promptMessageId}, Error: ${args.error}`);
  },
});
