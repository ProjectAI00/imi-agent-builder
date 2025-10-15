import { NextRequest, NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { z } from "zod";

// Important: Node runtime (not Edge) for SDK + network + streaming
export const runtime = "nodejs";

type Body = {
  threadId: string;
  userId: string;
  promptMessageId?: string;
  userMessage?: string;
};

/**
 * Claude Agent SDK Orchestrator (Plan A)
 *
 * This API route drives multi-step orchestration using the Claude Agent SDK
 * while delegating all tool execution and state persistence to Convex.
 *
 * It returns a JSON payload with the final assistant text and any tool summaries.
 * In a later step we can stream tokens (SSE) or push results back into Convex directly.
 */
export async function POST(req: NextRequest) {
  try {
    if (process.env.CLAUDE_AGENT_ENABLED !== "true") {
      return NextResponse.json({ error: "Claude orchestrator disabled" }, { status: 400 });
    }

    const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
    if (!ANTHROPIC_API_KEY) {
      return NextResponse.json({ error: "Missing ANTHROPIC_API_KEY" }, { status: 500 });
    }

    const body: Body = await req.json();
    const { threadId, userId, userMessage } = body;
    if (!threadId || !userId) {
      return NextResponse.json({ error: "threadId and userId are required" }, { status: 400 });
    }

    // Convex client for tool adapters
    const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

    // Dynamically import SDK to reduce cold start when feature flag is off
    const sdk = await import("@anthropic-ai/claude-agent-sdk");
    const { tool, createSdkMcpServer, query } = sdk as any;

    // Define MCP tools that forward to Convex actions
    const memorySearch = tool(
      "memory.search",
      "Search recent user memories to recall prior conversations.",
      { query: z.string() },
      async (args: { query: string }) => {
        const generated: any = await import("../../../../../convex/_generated/api");
        const apiAny = generated.api;
        const data = await (convex as any).action(apiAny.bridge?.searchMemoryAction?.run, {
          userId,
          query: args.query,
        } as any);
        return { type: "json", value: data };
      }
    );

    const twitterSearch = tool(
      "twitter.search",
      "Search tweets via RapidAPI (supports from:username, keywords).",
      { query: z.string(), limit: z.number().optional() },
      async (args: { query: string; limit?: number }) => {
        const generated: any = await import("../../../../../convex/_generated/api");
        const apiAny = generated.api;
        const data = await (convex as any).action(apiAny.bridge?.searchTwitterAction?.run, {
          userId,
          query: args.query,
          limit: args.limit ?? 20,
        } as any);
        return { type: "json", value: data };
      }
    );

    const appRouter = tool(
      "app.integrations",
      "Search/execute actions across 500+ apps via Composio Tool Router.",
      {
        action: z.enum(["search", "execute", "check_connections", "initiate_connection"]),
        taskDescription: z.string().optional(),
        appFilter: z.array(z.string()).optional(),
        appName: z.string().optional(),
        toolSlug: z.string().optional(),
        toolArguments: z.any().optional(),
      },
      async (args: any) => {
        // Optional safety: require explicit env to allow write operations
        if (args.action === "execute" && process.env.ALLOW_WRITE_TOOLS !== "true") {
          return { type: "error-text", value: "Write tools are disabled by server policy" };
        }
        const generated: any = await import("../../../../../convex/_generated/api");
        const apiAny = generated.api;
        const data = await (convex as any).action(apiAny.bridge?.appIntegrationsAction?.run, {
          userId,
          ...args,
        } as any);
        return { type: "json", value: data };
      }
    );

    // Mount in-process MCP server with only our safe tools
    const convexMcp = createSdkMcpServer({
      name: "convex-bridge",
      tools: [memorySearch, twitterSearch, appRouter],
    });

    // Build system prompt (reuse your agent persona at a high level)
    const systemPrompt = `
You are Imi, a conversational assistant. Use tools when helpful, but keep replies concise and natural.
Never expose tool names or internal routing. For complex multi-step tasks, plan briefly and execute.
`;

    // Fetch user message if not provided (optional: pull last user message from Convex thread)
    const prompt = userMessage ?? "";

    // Choose model based on prompt length/complexity for latency
    const isShort = (prompt.trim().length <= 200) && !/@|\bemail\b|\bnotion\b|\bslack\b|\btwitter\b|\bplan\b/i.test(prompt);
    const chosenModel = isShort
      ? (process.env.CLAUDE_FAST_MODEL || "claude-3-haiku-20240307")
      : (process.env.CLAUDE_MODEL || "claude-3-5-sonnet-latest");

    // Run orchestration
    const generator = query({
      prompt,
      options: {
        systemPrompt,
        model: chosenModel,
        mcpServers: {
          convex: convexMcp,
        },
        executable: 'node',
        pathToClaudeCodeExecutable: process.env.CLAUDE_CODE_EXEC || process.execPath,
        allowedTools: ["memory.search", "twitter.search", "app.integrations"],
        canUseTool: async (toolName: string, input: any) => {
          // Auto-allow read/search tools; deny writes unless explicitly enabled
          if (toolName === "memory.search") return { behavior: "allow", updatedInput: input } as any;
          if (toolName === "twitter.search") return { behavior: "allow", updatedInput: input } as any;
          if (toolName === "app.integrations") {
            const action = input?.action;
            if (action === "search" || action === "check_connections" || action === "initiate_connection") {
              return { behavior: "allow", updatedInput: input } as any;
            }
            if (action === "execute") {
              if (process.env.ALLOW_WRITE_TOOLS === "true") {
                return { behavior: "allow", updatedInput: input } as any;
              }
              return { behavior: "deny", message: "Write tools disabled by server policy" } as any;
            }
          }
          // Default: deny unknown tools
          return { behavior: "deny", message: "Tool not permitted" } as any;
        },
        settingSources: [], // no filesystem dependency in serverless
        permissionMode: "default",
        env: process.env,
      },
    });

    let assistantText = "";
    for await (const msg of generator as AsyncGenerator<any>) {
      if (msg?.type === "assistant" && msg?.message?.content) {
        // Aggregate text parts
        const parts = Array.isArray(msg.message.content)
          ? msg.message.content
              .filter((p: any) => p?.type === "text" && typeof p.text === "string")
              .map((p: any) => p.text)
          : [String(msg.message.content || "")];
        assistantText += parts.join("\n");
      }
    }

    return NextResponse.json({ ok: true, threadId, userId, text: assistantText });
  } catch (err: any) {
    console.error("[Claude Orchestrator] Error:", err);
    return NextResponse.json({ error: err?.message || "Internal error" }, { status: 500 });
  }
}
