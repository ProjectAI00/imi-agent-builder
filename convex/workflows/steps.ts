import { internalAction } from "../_generated/server";
import { v } from "convex/values";
import { api, internal } from "../_generated/api";
import { getAgent } from "../agents/index";

/**
 * STEP 1: Create execution plan
 *
 * Searches for relevant tools using appIntegrations
 * Returns a list of tools that can handle the user's request
 */
export const createPlan: any = internalAction({
  args: {
    userMessage: v.string(),
    userId: v.string(),
  },
  handler: async (ctx, { userMessage, userId }): Promise<any> => {
    // Check if this is an app integration task
    const isAppIntegrationTask =
      userMessage.toLowerCase().includes("email") ||
      userMessage.toLowerCase().includes("gmail") ||
      userMessage.toLowerCase().includes("docs") ||
      userMessage.toLowerCase().includes("document") ||
      userMessage.toLowerCase().includes("google") ||
      userMessage.toLowerCase().includes("notion") ||
      userMessage.toLowerCase().includes("slack");

    if (isAppIntegrationTask) {
      try {
        // Use the appIntegrations handler directly (handles session management)
        const { appIntegrationsHandler } = await import("../tools/appIntegrations");

        // First, check what apps are connected
        const connectionsResult = await appIntegrationsHandler(
          { ...ctx, userId } as any,
          {
            action: "check_connections",
          }
        );

        const connectedApps = (connectionsResult.data as any)?.connectedApps || [];

        const searchResult = await appIntegrationsHandler(
          { ...ctx, userId } as any,
          {
            action: "search",
            taskDescription: userMessage,
            appFilter: connectedApps.length > 0 ? connectedApps : undefined,
          }
        );

        if (!searchResult.success) {
          throw new Error(searchResult.message);
        }

        const searchData = searchResult.data as any;

        // Parse tools from response
        let tools = [];
        if (searchData?.data?.main_tools) {
          tools = searchData.data.main_tools;
        } else if (searchData?.tools) {
          tools = searchData.tools;
        } else if (searchData?.data?.tools) {
          tools = searchData.data.tools;
        } else if (Array.isArray(searchData)) {
          tools = searchData;
        }

        console.log(`[Step 1] Found ${tools.length} tool(s)`);

        // If no tools found, check if user needs to connect apps
        if (tools.length === 0) {
          const connectedApps = (connectionsResult.data as any)?.connectedApps || [];

          // Determine which app they need (Gmail, Notion, Slack, etc)
          const neededApp =
            userMessage.toLowerCase().includes("email") || userMessage.toLowerCase().includes("gmail") ? "gmail" :
            userMessage.toLowerCase().includes("notion") ? "notion" :
            userMessage.toLowerCase().includes("slack") ? "slack" :
            userMessage.toLowerCase().includes("docs") || userMessage.toLowerCase().includes("document") ? "googledocs" :
            "gmail"; // default

          if (!connectedApps.includes(neededApp)) {
            console.log(`[Step 1: Planning] User needs to connect ${neededApp}`);

            // Return a connection plan instead of error
            return {
              type: "needsConnection",
              app: neededApp,
              connectedApps: connectedApps,
              userMessage: userMessage,
            };
          }

          throw new Error(`No tools found for this request, even though ${neededApp} is connected`);
        }

        return {
          type: "appIntegration",
          tools: tools,
          useCase: userMessage,
        };
      } catch (error) {
        console.error("[Step 1: Planning] Error searching for tools:", error);
        return {
          type: "error",
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    }

    // For other tasks (Twitter, etc), create simple plan
    console.log("[Step 1: Planning] Using simple plan for non-app-integration task");

    return {
      type: "simple",
      actions: [{
        tool: "searchTwitter",
        args: { query: userMessage }
      }]
    };
  }
});

/**
 * Helper: Detect tool dependencies and group into stages
 *
 * Returns an array of stages where each stage contains tools that can run in parallel
 */
function detectDependencies(tools: any[]): any[][] {
  // Stage 1: Tools that list/search (no dependencies)
  const listTools = tools.filter((t: any) =>
    t.tool_slug.includes('LIST') ||
    t.tool_slug.includes('SEARCH') ||
    t.tool_slug.includes('GET_') && !t.tool_slug.includes('GET_DOCUMENT') &&
!t.tool_slug.includes('GET_EMAIL')
  );

  // Stage 2: Tools that fetch individual items (depend on Stage 1)
  const fetchTools = tools.filter((t: any) =>
    t.tool_slug.includes('GET_DOCUMENT') ||
    t.tool_slug.includes('GET_EMAIL') ||
    t.tool_slug.includes('GET_PAGE') ||
    t.tool_slug.includes('FIND_FILE')
  );

  // Stage 3: Tools that create/send/post (depend on Stage 2)
  const actionTools = tools.filter((t: any) =>
    t.tool_slug.includes('SEND') ||
    t.tool_slug.includes('CREATE') ||
    t.tool_slug.includes('POST') ||
    t.tool_slug.includes('UPDATE')
  );

  // Build stages (filter out empty arrays)
  const stages = [listTools, fetchTools, actionTools].filter(stage => stage.length > 0);

  console.log(`[Dependency Detection] Created ${stages.length} stages:`,
    stages.map((s, i) => `Stage ${i+1}: ${s.length} tools`));

  return stages.length > 0 ? stages : [tools]; // Fallback: all tools in one stage
}

/**
 * STEP 2: Execute tools based on plan
 *
 * NOW WITH SMART PARALLELIZATION:
 * - Detects dependencies between tools
 * - Groups into stages (sequential between stages, parallel within)
 * - Passes user context and previous results to each stage
 */
export const executeTools: any = internalAction({
  args: {
    plan: v.any(),
    userId: v.string(),
  },
  handler: async (ctx, { plan, userId }): Promise<any> => {
    console.log(`[Step 2: Execution] Executing ${plan.type} plan`);

    // Get user context for better parameter generation
    let userContext = {
      userId,
      email: `${userId}@example.com`, // Default fallback
      name: userId,
    };

    try {
      // Try to get user from database
      const user = await ctx.runQuery(api.users.getOrCreate.getByUserId, { userId });
      if (user) {
        userContext = {
          userId,
          email: user.email || userContext.email,
          name: user.username || userId,
        };
      }
    } catch (error) {
      console.warn(`[Step 2] Could not fetch user context, using defaults:`, error);
    }

    console.log(`[Step 2] User context:`, userContext);

    if (plan.type === "needsConnection") {
      try {
        console.log(`[Step 2: Execution] User needs to connect ${plan.app}`);

        const { appIntegrationsHandler } = await import("../tools/appIntegrations");

        // Initiate connection
        const connectionResult = await appIntegrationsHandler(
          { ...ctx, userId } as any,
          {
            action: "initiate_connection",
            appName: plan.app,
          }
        );

        console.log("[Step 2: Execution] Connection initiation result:", connectionResult);

        return {
          type: "needsConnection",
          data: connectionResult,
          app: plan.app,
        };
      } catch (error) {
        console.error("[Step 2: Execution] Error initiating connection:", error);
        return {
          type: "error",
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    }

    if (plan.type === "appIntegration") {
      try {
        const tools = plan.tools || [];

        if (tools.length === 0) {
          throw new Error("No tools found in plan");
        }

        // 🚀 SMART PARALLELIZATION: Detect dependencies and create stages
        const stages = detectDependencies(tools);

        // Get session once for all stages
        const session: any = await ctx.runQuery(api.toolRouter.sessions.getByUserId, { userId });
        if (!session) {
          throw new Error("No ToolRouter session found");
        }

        const { ToolRouterClient } = await import("../lib/toolRouterClient");
        const client: any = new ToolRouterClient(session.sessionUrl);
        await client.connect();

        // Import dependencies
        const { generateObject } = await import("ai");
        const { createOpenRouter } = await import("@openrouter/ai-sdk-provider");
        const { z } = await import("zod");
        const openrouter = createOpenRouter({ apiKey: process.env.OPENROUTER_API_KEY! });

        // Execute stages sequentially, tools within stage in parallel
        let allResults: any = {};
        let stageResults: any[] = [];

        for (let stageIndex = 0; stageIndex < stages.length; stageIndex++) {
          const stageTools = stages[stageIndex];
          console.log(`[Step 2] ⚡ Executing Stage ${stageIndex + 1}/${stages.length} with ${stageTools.length} tool(s)`);

          // Generate parameters for all tools in this stage IN PARALLEL
          const toolCallsWithParams = await Promise.all(
            stageTools.map(async (tool: any) => {
              const { object } = await generateObject({
                model: openrouter("x-ai/grok-4-fast"),
                schema: z.object({
                  arguments: z.record(z.any()),
                }),
                prompt: `You are a precise tool parameter generator for Stage ${stageIndex + 1}.

USER CONTEXT:
- User ID: ${userContext.userId}
- User Email: ${userContext.email}
- User Name: ${userContext.name}

USER REQUEST: "${plan.useCase}"

TOOL TO CALL: ${tool.tool_slug}
TOOL DESCRIPTION: ${tool.description}

INPUT SCHEMA:
${JSON.stringify(tool.input_schema, null, 2)}

${stageIndex > 0 ? `PREVIOUS STAGE RESULTS (use these for IDs, data, etc.):
${JSON.stringify(stageResults[stageIndex - 1], null, 2)}` : 'This is the first stage - no previous results yet.'}

CRITICAL INSTRUCTIONS:
1. When user says "me", "myself", "my email" → Use: ${userContext.email}
2. When user wants "latest N items" → Use: order_by: "modifiedTime desc" (or similar), max_results: N
3. If this stage needs IDs/data from previous stage → Extract them from PREVIOUS STAGE RESULTS
4. If user wants to "send" something → The content is in previous results
5. NEVER use placeholder values like "me" or "user@example.com" - use actual values from context

EXAMPLES FOR YOUR TOOL TYPE:
${tool.tool_slug.includes('LIST') || tool.tool_slug.includes('SEARCH') ?
  '- order_by: "modifiedTime desc" or "createdTime desc"\n- max_results: extract number from user request (e.g., "5 latest" → 5)' :
  tool.tool_slug.includes('GET') ?
  '- Extract IDs/document_ids from previous stage results\n- Use the actual file IDs, not placeholders' :
  tool.tool_slug.includes('SEND') || tool.tool_slug.includes('CREATE') ?
  `- to: "${userContext.email}" (user's actual email)\n- Extract content/data from previous results\n- Don't use placeholders` :
  '- Use sensible defaults from the schema'
}

Generate ONLY the arguments object. No explanations.`,
              });

              return {
                tool_slug: tool.tool_slug,
                arguments: object.arguments,
              };
            })
          );

          console.log(`[Step 2] Generated params for ${toolCallsWithParams.length} tool(s) in Stage ${stageIndex + 1}`);

          // Execute all tools in this stage IN PARALLEL
          const stageResult: any = await client.executeTools(toolCallsWithParams);

          console.log(`[Step 2] ✅ Stage ${stageIndex + 1} completed`);

          // Store results for next stage
          stageResults.push(stageResult);
          allResults[`stage_${stageIndex + 1}`] = stageResult;
        }

        await client.disconnect();

        console.log(`[Step 2] 🎉 All ${stages.length} stages executed successfully`);

        return {
          type: "appIntegration",
          data: allResults,
          stages: stageResults,
          useCase: plan.useCase,
        };
      } catch (error) {
        console.error("[Step 2] Error:", error);
        return {
          type: "error",
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    }

    if (plan.type === "error") {
      return plan;
    }

    // Execute simple tools (Twitter, etc)
    console.log("[Step 2: Execution] Executing simple tools");

    // For now, return placeholder - extend this for other tools
    return {
      type: "simple",
      data: { message: "Simple tool execution - extend as needed" }
    };
  }
});

/**
 * STEP 3: Summarize results
 *
 * Compresses large tool outputs into manageable summaries
 * This prevents context overflow in the conversational agent
 */
export const summarizeResults = internalAction({
  args: {
    toolResults: v.any(),
    userMessage: v.string(),
  },
  handler: async (ctx, { toolResults, userMessage }) => {

    // If there was an error, return error summary
    if (toolResults.type === "error") {
      return {
        summary: `There was an error executing the task: ${toolResults.error}`,
        originalRequest: userMessage,
        hasError: true,
      };
    }

    // If user needs to connect an app, return special summary
    if (toolResults.type === "needsConnection") {
      const connectionData = toolResults.data as any;
      if (connectionData.success && connectionData.data?.connectionUrl) {
        return {
          summary: `To complete this task, you need to connect your ${toolResults.app} account first. ${connectionData.message}`,
          originalRequest: userMessage,
          hasError: false,
          needsAuth: true,
          authUrl: connectionData.data.connectionUrl,
          app: toolResults.app,
        };
      }

      return {
        summary: `You need to connect your ${toolResults.app} account to complete this task.`,
        originalRequest: userMessage,
        hasError: true,
      };
    }

    try {
      // Use Grok-4-fast to summarize (fast, large context)
      const { createOpenRouter } = await import("@openrouter/ai-sdk-provider");
      const { generateText } = await import("ai");
      const openrouter = createOpenRouter({ apiKey: process.env.OPENROUTER_API_KEY! });

      const { text } = await generateText({
        model: openrouter("x-ai/grok-4-fast"),
        prompt: `User asked: "${userMessage}"

Tool execution returned this data:
${JSON.stringify(toolResults.data, null, 2)}

Summarize the KEY findings in a clear, concise way. Focus on:
1. What was accomplished
2. Important data/results
3. Any actions taken

Keep it under 500 tokens.`,
      });

      return {
        summary: text,
        originalRequest: userMessage,
        hasError: false,
      };
    } catch (error) {
      console.error("[Step 3] Error summarizing:", error);

      // Fallback: basic summary
      return {
        summary: `Task completed. Raw results: ${JSON.stringify(toolResults.data).substring(0, 200)}...`,
        originalRequest: userMessage,
        hasError: false,
      };
    }
  }
});

/**
 * STEP 4: Generate conversational response
 *
 * Uses roastAgent to format the summary with personality
 * and stream the response to the user
 */
export const generateConversationalResponse = internalAction({
  args: {
    threadId: v.string(),
    userId: v.string(),
    summary: v.any(),
    promptMessageId: v.string(),
  },
  handler: async (ctx, { threadId, userId, summary, promptMessageId }) => {
    try {
      const agent = getAgent("roast");

      const prompt = summary.hasError
        ? `Something went wrong: ${summary.summary}\n\nExplain this to the user in a friendly way.`
        : `I completed the task. Here's what happened:

${summary.summary}

Format this nicely for the user with your personality. Keep it conversational.`;

      const result = await agent.streamText(
        ctx,
        { threadId, userId },
        {
          prompt,
          promptMessageId,
        },
        {
          saveStreamDeltas: {
            chunking: "word",
            throttleMs: 100,
          }
        }
      );

      await result.consumeStream();
      console.log("[Step 4] Response sent");
    } catch (error) {
      console.error("[Step 4] Error:", error);

      // Fallback: save a simple message
      throw error;
    }
  }
});
