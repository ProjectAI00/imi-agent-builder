/**
 * Streaming Agent Loop - Event-Driven Architecture
 *
 * Key improvements over claudeAgentLoop.ts:
 * 1. Streams events in real-time (no waiting for completion)
 * 2. Supports subagent delegation via Task tool
 * 3. Parallel tool execution where possible
 * 4. Follows Anthropic's chain-of-thought patterns
 */

import { streamText, type LanguageModel } from "ai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { openai } from "@ai-sdk/openai";
import { z } from "zod";
import type { ActionCtx } from "../_generated/server";
import { api, internal } from "../_generated/api";
import { resolveDefaultModel, resolveModel } from "../../config/models";
import { IMI_SYSTEM_PROMPT } from "./prompts/imi";

// Event types that get streamed to UI
export type AgentEvent =
  | { type: 'thinking'; content: string }
  | { type: 'tool_call_start'; tool: string; input: any; callId: string }
  | { type: 'tool_call_complete'; tool: string; result: any; callId: string }
  | { type: 'text_delta'; delta: string }
  | { type: 'subagent_start'; agent: string; task: string }
  | { type: 'subagent_complete'; agent: string; result: string }
  | { type: 'error'; error: string; recoverable: boolean }
  | { type: 'complete'; finalText: string; stats: AgentStats };

export interface AgentStats {
  iterations: number;
  toolsCalled: string[];
  tokensUsed?: number;
  durationMs: number;
}

// Subagent definition following Claude SDK patterns
export interface SubagentDefinition {
  name: string;
  description: string;  // When should this agent be used?
  tools?: string[];     // Subset of tools (omit = inherit all)
  systemPrompt: string;
  model?: string;       // Override default model
}

// Build tool schemas with Zod to ensure provider-compatible JSON Schema
function buildToolSchemas(config: StreamingAgentConfig) {
  const hasSubagents = !!(config.subagents && Object.keys(config.subagents).length > 0);

  const memorySearch = {
    description:
      "Search user's conversation history and stored memories. Use when you need context from past discussions.",
    inputSchema: z.object({
      query: z
        .string()
        .describe("Keywords to search for in memory (e.g., 'email preferences', 'project deadlines')"),
    }),
  } as const;

  const twitterSearch = {
    description: "Search tweets and Twitter content. Supports 'from:username' syntax.",
    inputSchema: z.object({
      query: z
        .string()
        .describe("Search query (e.g., 'from:elonmusk AI', 'machine learning')"),
      limit: z.number().optional().describe("Max tweets to return (default: 20)"),
    }),
  } as const;

  const appIntegrations = {
    description:
      "Access 500+ apps (Gmail, Slack, Notion, Google Drive, etc.) via Composio. Multi-step workflow: 1) search for tools, 2) check_connections, 3) execute.",
    inputSchema: z.object({
      action: z
        .enum(["search", "execute", "check_connections", "initiate_connection"]) // required
        .describe(
          "Action: 'search' (find tools), 'execute' (run tool), 'check_connections' (verify auth), 'initiate_connection' (OAuth)",
        ),
      taskDescription: z
        .string()
        .optional()
        .describe("For 'search': what you want to do (e.g., 'send email via Gmail')"),
      appFilter: z.array(z.string()).optional().describe(
        "For 'search': limit to specific apps (e.g., ['gmail', 'googledocs'])",
      ),
      appName: z.string().optional().describe("For 'initiate_connection': app to connect (e.g., 'gmail')"),
      toolSlug: z
        .string()
        .optional()
        .describe("For 'execute': tool identifier from search results (e.g., 'GMAIL_SEND_EMAIL')"),
      toolArguments: z.record(z.any()).optional().describe("For 'execute': arguments required by the tool"),
    }),
  } as const;

  const tools: Record<string, { description: string; inputSchema: any }> = {
    memory_search: memorySearch,
    twitter_search: twitterSearch,
    app_integrations: appIntegrations,
  };

  if (hasSubagents) {
    const subagentNames = Object.keys(config.subagents!);
    tools["task"] = {
      description:
        "Delegate a task to a specialized subagent. Use this when you need focused expertise (email writing, document creation, data analysis).",
      inputSchema: z.object({
        description: z
          .string()
          .describe("Short 3-5 word description of the task (e.g., 'Draft email to client')"),
        prompt: z
          .string()
          .describe(
            "Detailed task for the subagent. Only provide GOAL and CONTEXT, not explicit instructions.",
          ),
        subagent_type: z
          .enum(subagentNames as [string, ...string[]])
          .describe("Which specialized agent to use"),
      }),
    } as const;
  }

  return tools;
}

// Default system prompt (imported from prompts/imi.ts)
const DEFAULT_SYSTEM_PROMPT = IMI_SYSTEM_PROMPT;

export interface StreamingAgentConfig {
  userId: string;
  threadId: string;
  userMessage: string;
  systemPrompt?: string;
  model?: string;
  maxIterations?: number;
  temperature?: number;
  allowedTools?: string[];
  recursionDepth?: number;  // Track subagent nesting
  onEvent?: (event: AgentEvent) => Promise<void>;
  scratchpadJobId?: string;
  subagents?: Record<string, SubagentDefinition>;
}

/**
 * Execute a tool via Convex bridges
 */
async function executeTool(
  ctx: ActionCtx,
  toolName: string,
  input: any,
  userId: string,
  config: StreamingAgentConfig,
  callId?: string
): Promise<any> {
  const jobId = config.scratchpadJobId;
  const stepId = callId ?? `${toolName}-${Date.now()}`;
  const threadId = config.threadId;
  const startedAt = Date.now();

  const markStep = async (patch: {
    status: string;
    startedAt?: number;
    completedAt?: number;
    result?: any;
    error?: string;
    retries?: number;
    rollbackStatus?: string;
  }) => {
    if (!jobId) return;
    await ctx.runMutation(internal.context.scratchpad.recordStepProgress, {
      jobId,
      step: {
        stepId,
        description: toolName,
        status: patch.status,
        startedAt: patch.startedAt,
        completedAt: patch.completedAt,
        retries: patch.retries,
        result: patch.result,
        error: patch.error,
        rollbackStatus: patch.rollbackStatus,
      },
    });
  };

  await markStep({ status: "running", startedAt: startedAt, retries: 0 });

  // Handle task delegation (subagent calls)
  try {
    if (toolName === "task") {
      const { description, prompt, subagent_type } = input;

      const availableSubagents = config.subagents ?? {};
      if (!Object.keys(availableSubagents).length) {
        throw new Error("Task delegation is disabled because no subagents are configured.");
      }

      const subagent = availableSubagents[subagent_type];
      if (!subagent) {
        throw new Error(`Unknown subagent type: ${subagent_type}`);
      }

      // Prevent infinite recursion
      const currentDepth = config.recursionDepth || 0;
      if (currentDepth >= 3) {
        throw new Error("Maximum subagent nesting depth (3) reached");
      }

      // Emit subagent start event
      await config.onEvent?.({
        type: 'subagent_start',
        agent: subagent_type,
        task: description
      });

      // Run subagent with its specialized config
      const subResult = await runStreamingAgentLoop(ctx, {
        ...config,
        userMessage: prompt,
        systemPrompt: subagent.systemPrompt,
        allowedTools: subagent.tools || config.allowedTools,
        model: subagent.model || config.model,
        recursionDepth: currentDepth + 1,
        maxIterations: 5,  // Subagents get fewer iterations
      });

      await config.onEvent?.({
        type: 'subagent_complete',
        agent: subagent_type,
        result: subResult.finalText
      });

      await markStep({
        status: "completed",
        completedAt: Date.now(),
        result: subResult.finalText,
      });

      await ctx.runMutation(internal.logs.telemetry.recordToolExecution, {
        userId,
        threadId,
        toolName,
        success: true,
        durationMs: Date.now() - startedAt,
        jobId,
        metadata: {
          subagent: subagent_type,
        },
      });

      return {
        agent: subagent_type,
        result: subResult.finalText,
        stats: subResult.stats
      };
    }

    // Regular tool execution
    switch (toolName) {
      case "memory_search": {
        const result = await ctx.runAction(api.bridge.searchMemoryAction.run, {
          userId,
          query: input.query
        });

        await markStep({
          status: "completed",
          completedAt: Date.now(),
          result,
        });

        await ctx.runMutation(internal.logs.telemetry.recordToolExecution, {
          userId,
          threadId,
          toolName,
          success: true,
          durationMs: Date.now() - startedAt,
          jobId,
        });

        return result;
      }

      case "twitter_search": {
        const result = await ctx.runAction(api.bridge.searchTwitterAction.run, {
          userId,
          query: input.query,
          limit: input.limit ?? 20
        });

        await markStep({
          status: "completed",
          completedAt: Date.now(),
          result,
        });

        await ctx.runMutation(internal.logs.telemetry.recordToolExecution, {
          userId,
          threadId,
          toolName,
          success: true,
          durationMs: Date.now() - startedAt,
          jobId,
        });

        return result;
      }

      case "app_integrations": {
        // Normalize and sanitize input to satisfy Convex validator
        const normalizeAction = (a: any): "search" | "execute" | "check_connections" | "initiate_connection" => {
          const s = String(a || "").toLowerCase().replace(/[-\s]/g, "_");
          if (["search", "search_tools", "find", "discover"].includes(s)) return "search";
          if (["execute", "run", "call", "invoke", "execute_tool"].includes(s)) return "execute";
          if (["check", "check_connections", "status", "connections"].includes(s)) return "check_connections";
          if (["initiate_connection", "initiate", "connect", "auth", "authorize", "initiate_auth", "initiateconnection"].includes(s)) return "initiate_connection";
          return "search";
        };

        const coerceArray = (v: any): string[] | undefined => {
          if (!v) return undefined;
          if (Array.isArray(v)) return v.map(String);
          if (typeof v === "string") return [v];
          return undefined;
        };

        const normalizedInput: any = {
          action: normalizeAction(input.action),
          taskDescription: input.taskDescription ?? input.task ?? input.description,
          appFilter: coerceArray(input.appFilter ?? input.apps),
          appName: input.appName ?? input.app,
          toolSlug: input.toolSlug ?? input.tool ?? input.tool_slug,
          toolArguments: input.toolArguments ?? input.arguments ?? input.args,
        };

        const result = await ctx.runAction(api.bridge.appIntegrationsAction.run, {
          userId,
          ...normalizedInput,
        });

        await markStep({
          status: "completed",
          completedAt: Date.now(),
          result,
        });

        await ctx.runMutation(internal.logs.telemetry.recordToolExecution, {
          userId,
          threadId,
          toolName,
          success: true,
          durationMs: Date.now() - startedAt,
          jobId,
        });

        return result;
      }

      default:
        throw new Error(`Unknown tool: ${toolName}`);
    }
  } catch (error) {
    await markStep({
      status: "failed",
      completedAt: Date.now(),
      error: error instanceof Error ? error.message : "Unknown error",
    });

    await ctx.runMutation(internal.logs.telemetry.recordToolExecution, {
      userId,
      threadId,
      toolName,
      success: false,
      durationMs: Date.now() - startedAt,
      jobId,
      error: error instanceof Error ? error.message : "Unknown error",
    });
    throw error;
  }
}

/**
 * Streaming Agent Loop - Emits events in real-time
 */
export async function runStreamingAgentLoop(
  ctx: ActionCtx,
  config: StreamingAgentConfig
): Promise<{ finalText: string; stats: AgentStats }> {
  const startTime = Date.now();

  const {
    userId,
    threadId,
    userMessage,
    systemPrompt = DEFAULT_SYSTEM_PROMPT,
    model = process.env.OR_MODEL,
    maxIterations = 10,
    temperature = 0.7,
    allowedTools,
    recursionDepth = 0,
    onEvent
  } = config;

  const openrouter = createOpenRouter({
    apiKey: process.env.OPENROUTER_API_KEY!
  });

  const selectedModel =
    resolveModel(model ?? process.env.OR_MODEL) ?? resolveDefaultModel();

  const scratchpadJobId = config.scratchpadJobId ?? `${threadId}:${startTime}`;

  // Fetch recent thread history for conversation continuity
  const threadHistoryResult = await ctx.runQuery(api.chat.messages.list, {
    threadId,
    paginationOpts: {
      numItems: 20,
      cursor: null,
    },
  });

  const threadHistory = threadHistoryResult?.page || [];
  console.log(`[StreamingAgent] Loaded ${threadHistory.length} messages from thread history`);

  // Fetch context from Layer 1's hybrid search system
  let contextSummary = await ctx.runQuery(api.context.storage.getContextSummary, {
    threadId,
    contextTypes: ["memory"],
  });

  if (contextSummary) {
    console.log(`[StreamingAgent] Using context from Layer 1 (${contextSummary.length} chars)`);
  } else {
    console.log(`[StreamingAgent] No context available from Layer 1`);
  }

  await ctx.runMutation(internal.context.scratchpad.upsertScratchpad, {
    jobId: scratchpadJobId,
    userId,
    threadId,
    status: "running",
    metadata: {
      userMessage,
      model: selectedModel,
    },
  });

  // Filter tools if specified; empty list means no tool access
  // Build Zod-backed tool schemas and filter by allowedTools if provided
  const allTools = buildToolSchemas(config);
  // Tool availability policy:
  // - allowedTools === undefined  => expose all tools
  // - allowedTools is []          => expose NO tools
  // - otherwise                   => expose only the listed tools
  const tools =
    allowedTools === undefined
      ? allTools
      : allowedTools.length === 0
      ? {}
      : Object.fromEntries(
          Object.entries(allTools).filter(([name]) => allowedTools.includes(name)),
        );

  // Build conversation history from thread messages
  const conversationHistory: Array<{ role: "user" | "assistant"; content: string }> = [];

  // Add thread history (excluding system messages)
  if (threadHistory && threadHistory.length > 0) {
    for (const msg of threadHistory) {
      if (msg.role === "user" || msg.role === "assistant") {
        // Skip hidden system messages
        if (msg.text && msg.text.startsWith("[SYSTEM:")) continue;

        conversationHistory.push({
          role: msg.role as "user" | "assistant",
          content: msg.text || "",
        });
      }
    }
  }

  // Add Layer 1 context as a hidden system message if available
  let systemMessage = systemPrompt;
  if (contextSummary) {
    systemMessage = `${systemPrompt}

<relevant_memories>
The following are relevant facts from past conversations. Use them naturally when appropriate:

${contextSummary}
</relevant_memories>`;

    console.log(`[StreamingAgent] Injecting ${contextSummary.split('\n').length} memory facts into system prompt`);
  }

  // Add current user message
  conversationHistory.push({
    role: "user",
    content: userMessage,
  });
  
  let iterations = 0;
  const toolsCalled: string[] = [];
  let finalText = "";
  let escalationTriggered = false;

  try {
    while (iterations < maxIterations) {
      iterations++;

      let streamedText = "";
      const toolCallsCollected: any[] = [];

      // OpenRouter model options (no provider override in payload)
      // Use medium reasoning effort across providers; UI still hides chain-of-thought
      const reasoningOptions: any = { reasoning: { effort: "medium" } };

      // Choose provider based on model prefix: use native OpenAI for "openai/*", otherwise OpenRouter
      const modelProviderFor = (name: string): LanguageModel => {
        if (name.startsWith("openai/")) {
          const native = name.replace(/^openai\//, "");
          return openai(native, reasoningOptions);
        }
        return openrouter(name, reasoningOptions);
      };

      const result = await streamText({
        model: modelProviderFor(selectedModel),
        system: systemMessage,
        messages: conversationHistory,
        tools,
        temperature,
        onChunk: async ({ chunk }) => {
          const c: any = chunk;
          if (!c) return;

          switch (c.type) {
            case "text-delta": {
              if (c.textDelta) {
                streamedText += c.textDelta;
                await onEvent?.({ type: 'text_delta', delta: c.textDelta });
              }
              break;
            }
            case "reasoning-delta": {
              const content = c.reasoningDelta?.text;
              if (content) {
                await onEvent?.({ type: 'thinking', content });
              }
              break;
            }
            case "tool-call":
            case "tool-call-delta":
            case "tool-result": {
              // Tool calls are handled after streaming completes; collect raw chunks for completeness
              if (c.toolCall) {
                toolCallsCollected.push(c.toolCall);
              }
              break;
            }
          }
        }
      });

      const resolvedText = result.text ? await result.text : streamedText;
      finalText = resolvedText || streamedText;

      const resolvedToolCalls: any[] = result.toolCalls
        ? await result.toolCalls
        : [];

      const toolCallsRaw: any[] = resolvedToolCalls.length > 0
        ? resolvedToolCalls
        : toolCallsCollected;

      // Determine required args per tool and filter out incomplete delta calls
      const requiredFor = (toolName: string): string[] => {
        switch (toolName) {
          case "memory_search":
            return ["query"];
          case "twitter_search":
            return ["query"]; // limit optional
          case "app_integrations":
            return ["action"]; // others depend on action
          case "task":
            return ["description", "prompt", "subagent_type"];
          default:
            return [];
        }
      };

      const toolCalls: any[] = toolCallsRaw.filter((tc: any) => {
        const name = tc.toolName;
        const args = tc.args || tc.input || {};
        const req = requiredFor(name);
        return req.every((k) => args && Object.prototype.hasOwnProperty.call(args, k));
      });

      if (toolCalls.length === 0) {
        break;  // Done
      }

      // Emit tool call start events
      for (const toolCall of toolCalls) {
        const callId = toolCall.toolCallId || `call_${Date.now()}`;
        const toolInput = (toolCall as any).args || (toolCall as any).input || {};
        await onEvent?.({
          type: 'tool_call_start',
          tool: toolCall.toolName,
          input: toolInput,
          callId
        });
      }

      // If delegating to subagent, do not surface internal status text to the user

      // Execute tools in parallel with simple retries
      const toolResults: { callId: string; toolName: string; result: string }[] = await Promise.all(
        toolCalls.map(async (toolCall: any) => {
          const callId = toolCall.toolCallId || `call_${Date.now()}`;
          const toolName = toolCall.toolName;
          const toolInput = toolCall.args || toolCall.input || {};

          toolsCalled.push(toolName);

          try {
            // Preflight required args check to avoid Convex arg validation errors
            const missing = requiredFor(toolName).filter((k) => toolInput[k] === undefined);
            if (missing.length > 0) {
              throw new Error(`Missing required parameter(s): ${missing.join(", ")}`);
            }
            // Retry-able execution
            const maxAttempts = 3;
            let attempt = 0;
            let lastError: any = null;
            let result: any = null;
            while (attempt < maxAttempts) {
              try {
                result = await executeTool(
                  ctx,
                  toolName,
                  toolInput,
                  userId,
                  { ...config, scratchpadJobId },
                  callId
                );
                break; // success
              } catch (err) {
                lastError = err;
                attempt++;
                if (attempt >= maxAttempts) throw err;
                // small backoff
                await new Promise((r) => setTimeout(r, 300 * attempt));
              }
            }

            await onEvent?.({
              type: 'tool_call_complete',
              tool: toolName,
              result,
              callId
            });

            return {
              callId,
              toolName,
              result: typeof result === "string" ? result : JSON.stringify(result)
            };
          } catch (error) {
            const errorMsg = error instanceof Error ? error.message : "Tool failed";

            await onEvent?.({
              type: 'error',
              error: `Tool ${toolName} failed: ${errorMsg}`,
              recoverable: true
            });

            if (scratchpadJobId && !escalationTriggered) {
              const pad = await ctx.runQuery(api.context.scratchpad.getByJobId, {
                jobId: scratchpadJobId,
              });

              const failedSteps = pad?.steps?.filter((step: any) => step.status === "failed").length ?? 0;
              if (failedSteps >= 3) {
                escalationTriggered = true;
                await onEvent?.({
                  type: 'error',
                  error: 'Multiple tools failed. Awaiting guidance from user.',
                  recoverable: false,
                });

                await ctx.runMutation(internal.context.scratchpad.upsertScratchpad, {
                  jobId: scratchpadJobId,
                  userId,
                  threadId,
                  status: "blocked",
                  metadata: {
                    failedSteps,
                    lastError: errorMsg,
                    escalation: true,
                  },
                });
              }
            }

            return {
              callId,
              toolName,
              result: `Error: ${errorMsg}`
            };
          }
        })
      );

      // Append assistant's response and tool results to conversation history
      if (finalText) {
        conversationHistory.push({
          role: "assistant",
          content: finalText,
        });
      }

      // Special-case: when delegating to subagents via the "task" tool, do NOT echo raw tool results.
      // Instead, treat the subagent's text result as the assistant's continuation to avoid leaking plumbing.
      const allTask = toolResults.every((r) => r.toolName === "task");
      if (allTask) {
        try {
          const texts: string[] = toolResults.map((r) => {
            try {
              const obj = JSON.parse(r.result);
              if (obj && typeof obj === 'object' && obj.result) return String(obj.result);
              return r.result;
            } catch {
              return r.result;
            }
          });
          const merged = texts.filter(Boolean).join("\n\n");
          if (merged) {
            conversationHistory.push({ role: "assistant", content: merged });
            finalText = merged;
          }
        } catch {
          // fallback: no-op
        }
      } else {
        // Add tool results as a user message (simulating function returns)
        const toolResultsText = toolResults
          .map((r: { callId: string; result: string }) => `${r.callId}: ${r.result}`)
          .join("\n\n");

        conversationHistory.push({
          role: "user",
          content: `[Tool Results]:\n${toolResultsText}\n\nRespond naturally to the user.`,
        });
      }
    }

    const stats: AgentStats = {
      iterations,
      toolsCalled,
      durationMs: Date.now() - startTime
    };

    await onEvent?.({
      type: 'complete',
      finalText,
      stats
    });

    await ctx.runMutation(internal.context.scratchpad.upsertScratchpad, {
      jobId: scratchpadJobId,
      userId,
      threadId,
      status: "completed",
      metadata: {
        finalText,
        iterations,
        toolsCalled,
      },
    });

    return { finalText, stats };

  } catch (error) {
    await ctx.runMutation(internal.context.scratchpad.upsertScratchpad, {
      jobId: scratchpadJobId,
      userId,
      threadId,
      status: "failed",
      metadata: {
        error: error instanceof Error ? error.message : "Unknown error",
      },
    });

    await onEvent?.({
      type: 'error',
      error: error instanceof Error ? error.message : "Unknown error",
      recoverable: false
    });
    throw error;
  }
}
