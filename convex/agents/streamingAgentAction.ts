/**
 * Convex Action Wrapper for Streaming Agent Loop
 *
 * Bridges the streamingAgentLoop's event system to Convex's message system
 * so the UI can see real-time updates via streamText deltas.
 */

import { v } from "convex/values";
import { internalAction } from "../_generated/server";
import { internal, components } from "../_generated/api";
import { runStreamingAgentLoop, type AgentEvent } from "./streamingAgentLoop";
import { SUBAGENTS } from "./subagents/index";

/**
 * Stream agent response with real-time events
 *
 * This action:
 * 1. Starts the streaming agent loop
 * 2. Converts agent events to message deltas
 * 3. Saves final response to database
 */
export const streamAgentResponse = internalAction({
  args: {
    threadId: v.string(),
    userId: v.string(),
    userMessage: v.string(),
    promptMessageId: v.string(),
    maxIterations: v.optional(v.number()),
    model: v.optional(v.string()),
    allowedTools: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const {
      threadId,
      userId,
      userMessage,
      promptMessageId,
      maxIterations = 10,
      model,
      allowedTools
    } = args;

    const scratchpadJobId = `${threadId}:${promptMessageId}`;

    // Simple confirmation gate: only allow delegation when user explicitly approves
    const explicitApprove = /(\bokay\b|\bok\b|\byes\b|\byea?h\b|\bgo ahead\b|\bplease send\b|\bsend it\b|\bdo it\b|\bproceed\b|\bconfirm\b|\bship it\b)/i.test(
      userMessage || ""
    );

    // Create pending assistant message to stream into
    const pendingMessage = await ctx.runMutation(components.agent.messages.addMessages as any, {
      threadId,
      userId,
      agentName: "Imi",
      promptMessageId,
      messages: [
        {
          message: {
            role: "assistant",
            content: "",
          },
          status: "pending",
        },
      ],
    });

    const pendingMessageId = pendingMessage.messages[0]?._id as string | undefined;
    let accumulatedText = pendingMessage.messages[0]?.text ?? "";
    let lastUpdate = Date.now();

    const flushMessage = async (force = false) => {
      if (!pendingMessageId) return;
      if (!force && Date.now() - lastUpdate < 90) return;

      try {
        await ctx.runMutation(components.agent.messages.updateMessage as any, {
          messageId: pendingMessageId,
          patch: {
            message: {
              role: "assistant",
              content: accumulatedText,
            },
            status: "pending",
          },
        });
        lastUpdate = Date.now();
      } catch (error) {
        console.error("[StreamingAgent] Failed to update pending message:", error);
      }
    };

    // Event handler that writes directly to the pending message
    const handleEvent = async (event: AgentEvent) => {
      const delta = formatEventsAsMessage([event]);
      if (!delta) {
        return;
      }

      accumulatedText += delta;
      const highPriority = event.type !== 'text_delta';
      await flushMessage(highPriority);
    };

    try {
      // Run the streaming agent loop with event callback and subagents
      // Default policy: Layer 2 should NOT call external tools directly.
      // Gate delegation via "task" until explicit user approval in this turn.
      const result = await runStreamingAgentLoop(ctx, {
        userId,
        threadId,
        userMessage,
        maxIterations,
        model,
        allowedTools:
          allowedTools && allowedTools.length > 0
            ? allowedTools
            : explicitApprove
            ? ["task"]
            : [],
        onEvent: handleEvent,
        scratchpadJobId,
        subagents: SUBAGENTS, // Enable Layer 3 tool calling via subagents
      });

      if (pendingMessageId) {
        accumulatedText = result.finalText;
        await ctx.runMutation(components.agent.messages.updateMessage as any, {
          messageId: pendingMessageId,
          patch: {
            message: {
              role: "assistant",
              content: result.finalText,
            },
            status: "success",
            finishReason: "stop",
          },
        });
      }

      console.log(`[StreamingAgent] Completed:`, {
        iterations: result.stats.iterations,
        toolsCalled: result.stats.toolsCalled,
        durationMs: result.stats.durationMs
      });

      return result;

    } catch (error) {
      console.error("[StreamingAgent] Error:", error);
      if (pendingMessageId) {
        await ctx.runMutation(components.agent.messages.updateMessage as any, {
          messageId: pendingMessageId,
          patch: {
            message: {
              role: "assistant",
              content: `Error: ${error instanceof Error ? error.message : "Unknown error"}`,
            },
            status: "failed",
            error: error instanceof Error ? error.message : "Unknown error",
          },
        });
      }

      throw error;
    }
  }
});

/**
 * Format agent events into a user-friendly message delta
 */
function formatEventsAsMessage(events: AgentEvent[]): string {
  const parts: string[] = [];

  for (const event of events) {
    switch (event.type) {
      case 'text_delta':
        parts.push(event.delta);
        break;

      case 'tool_call_start':
        // Show tool invocation to user
        parts.push(`\n\n*Using ${formatToolName(event.tool)}...*`);
        break;

      case 'tool_call_complete':
        // Optionally show result summary (can be verbose)
        if (shouldShowToolResult(event.tool)) {
          const summary = summarizeToolResult(event.result);
          if (summary) {
            parts.push(`\n${summary}`);
          }
        }
        break;

      case 'subagent_start':
        parts.push(`\n\n*Delegating to ${formatAgentName(event.agent)} specialist...*`);
        break;

      case 'subagent_complete':
        // Include subagent result in the response
        parts.push(`\n\n${event.result}`);
        break;

      case 'error':
        if (event.recoverable) {
          parts.push(`\n*Note: ${event.error}*`);
        } else {
          parts.push(`\n\n**Error**: ${event.error}`);
        }
        break;

      case 'thinking':
        // Only show thinking in debug mode
        if (process.env.SHOW_AGENT_THINKING === "true") {
          parts.push(`\n*Thinking: ${event.content}*`);
        }
        break;

      case 'complete':
        // Final complete event doesn't need display (handled separately)
        break;
    }
  }

  return parts.join("");
}

/**
 * Format tool names for display
 */
function formatToolName(toolName: string): string {
  const names: Record<string, string> = {
    'memory_search': 'memory search',
    'twitter_search': 'Twitter search',
    'app_integrations': 'app integration',
    'task': 'specialist agent'
  };
  return names[toolName] || toolName;
}

/**
 * Format agent names for display
 */
function formatAgentName(agentType: string): string {
  const names: Record<string, string> = {
    'tool_executor': 'Tool Executor',
  };
  return names[agentType] || agentType;
}

/**
 * Determine if tool result should be shown to user
 */
function shouldShowToolResult(toolName: string): boolean {
  // Only show results for these tools (others are too verbose)
  return ['memory_search', 'twitter_search'].includes(toolName);
}

/**
 * Summarize tool result for display
 */
function summarizeToolResult(result: any): string | null {
  if (!result) return null;

  try {
    // If result is a string, truncate if too long
    if (typeof result === 'string') {
      return result.length > 200 ? `${result.slice(0, 200)}...` : result;
    }

    // If result is an object with summary fields
    if (typeof result === 'object') {
      if (result.summary) return result.summary;
      if (result.count !== undefined) return `Found ${result.count} results`;
    }

    return null;
  } catch {
    return null;
  }
}
