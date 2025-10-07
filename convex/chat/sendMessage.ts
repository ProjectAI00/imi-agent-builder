import { v } from "convex/values";
import { action, internalAction, internalMutation } from "../_generated/server";
import { internal, components } from "../_generated/api";
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
      skipEmbeddings: false,
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

/**
 * Internal action to generate the AI response
 * Routes to either direct agent (simple) or workflow (complex)
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
      // Get the user's message text
      const messagesResult = await ctx.runQuery(components.agent.messages.listMessagesByThreadId, {
        threadId,
        order: "desc" as const,
      });

      const userMessage = messagesResult.page.find((m: any) => m._id === promptMessageId);

      if (!userMessage || !userMessage.text) {
        throw new Error("User message not found");
      }

      // ✅ SMART ROUTING: Analyze if this is simple or complex
      const { analyzeTaskComplexity } = await import("../lib/taskAnalyzer");
      const analysis = await analyzeTaskComplexity(userMessage.text);

      if (analysis.isComplex) {
        // Complex multi-step → Use Workflow for orchestration
        console.log(`[Router → Workflow] Complex task: ${analysis.reasoning}`);

        const { WorkflowManager } = await import("@convex-dev/workflow");
        const workflow = new WorkflowManager(components.workflow);

        const workflowId = await workflow.start(
          ctx,
          internal.workflows.agentOrchestration.executeUserRequest,
          {
            threadId,
            userId,
            userMessage: userMessage.text,
            promptMessageId,
          }
        );

        console.log(`[Router → Workflow] Started: ${workflowId}`);
      } else {
        // Simple single-step → Use Agent directly (fast!)
        console.log(`[Router → Agent] Simple task: ${analysis.reasoning}`);

        const agent = getAgent(agentType);
        const result = await agent.streamText(
          ctx,
          { threadId, userId },
          { promptMessageId },
          {
            saveStreamDeltas: {
              chunking: "word",
              throttleMs: 100,
            }
          }
        );

        await result.consumeStream();
        console.log(`[Router → Agent] Completed`);
      }

    } catch (error) {
      console.error("[Router] Error:", error);

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
  handler: async (_ctx, args) => {
    // You could save this to a dedicated errors table
    console.error(`[Error Log] Thread: ${args.threadId}, Message: ${args.promptMessageId}, Error: ${args.error}`);
  },
});