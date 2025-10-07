import { WorkflowManager } from "@convex-dev/workflow";
import { components } from "../_generated/api";
import { v } from "convex/values";
import { internal } from "../_generated/api";

const workflow = new WorkflowManager(components.workflow);

/**
 * Main Agent Workflow - Orchestrates task execution across multiple steps
 *
 * Each step runs in its own fresh context window (128k tokens each)
 *
 * Flow:
 * 1. Planning - Determine what needs to be done
 * 2. Tool Execution - Execute tools (Composio handles parallel execution)
 * 3. Summarization - Compress results to manageable size
 * 4. Conversational Response - Format with personality for user
 */
export const executeUserRequest = workflow.define({
  args: {
    threadId: v.string(),
    userId: v.string(),
    userMessage: v.string(),
    promptMessageId: v.string(),
  },

  handler: async (step, { threadId, userId, userMessage, promptMessageId }) => {
    // STEP 1: PLANNING
    // @ts-expect-error - Type will be available after deployment
    const plan = await step.runAction(internal.workflows.steps.createPlan, {
      userMessage,
      userId,
    });

    // STEP 2: TOOL EXECUTION
    // @ts-expect-error - Type will be available after deployment
    const toolResults = await step.runAction(internal.workflows.steps.executeTools, {
      plan,
      userId,
    });

    // STEP 3: SUMMARIZATION
    const summary = await step.runAction(internal.workflows.steps.summarizeResults, {
      toolResults,
      userMessage,
    });

    // STEP 4: CONVERSATIONAL RESPONSE
    await step.runAction(internal.workflows.steps.generateConversationalResponse, {
      threadId,
      userId,
      summary,
      promptMessageId,
    });

    return { success: true };
  }
});
