import { internalAction } from "../_generated/server";
import { api } from "../_generated/api";

/**
 * Test ToolRouter functionality directly
 *
 * Run this via: npx convex run test/testToolRouter:runTest --userId "advicebyaimar"
 */
export const runTest = internalAction({
  args: {},
  handler: async (ctx) => {
    const userId = "advicebyaimar"; // Your actual user ID from logs

    console.log("=== ToolRouter Test Started ===");
    console.log("User ID:", userId);

    try {
      // Import the handler
      const { appIntegrationsHandler } = await import("../tools/appIntegrations");

      // TEST 1: Check connections
      console.log("\n[TEST 1] Checking connected apps...");
      const connectionsResult = await appIntegrationsHandler(
        { ...ctx, userId } as any,
        { action: "check_connections" }
      );

      console.log("Connections result:", JSON.stringify(connectionsResult, null, 2));
      const connectedApps = (connectionsResult.data as any)?.connectedApps || [];
      console.log("Connected apps:", connectedApps);

      // TEST 2: Search for Gmail tools
      console.log("\n[TEST 2] Searching for Gmail tools with query: 'list emails'...");
      const gmailSearchResult = await appIntegrationsHandler(
        { ...ctx, userId } as any,
        {
          action: "search",
          taskDescription: "list emails from gmail",
          appFilter: ["gmail"],
        }
      );

      console.log("Gmail search result:", JSON.stringify(gmailSearchResult, null, 2));

      if (gmailSearchResult.success) {
        const tools = (gmailSearchResult.data as any)?.tools || [];
        console.log(`Found ${tools.length} Gmail tools`);
        if (tools.length > 0) {
          console.log("First tool:", JSON.stringify(tools[0], null, 2));
        }
      }

      // TEST 3: Search for Google Docs tools
      console.log("\n[TEST 3] Searching for Google Docs tools with query: 'list documents'...");
      const docsSearchResult = await appIntegrationsHandler(
        { ...ctx, userId } as any,
        {
          action: "search",
          taskDescription: "list google documents",
          appFilter: ["googledocs"],
        }
      );

      console.log("Docs search result:", JSON.stringify(docsSearchResult, null, 2));

      if (docsSearchResult.success) {
        const tools = (docsSearchResult.data as any)?.tools || [];
        console.log(`Found ${tools.length} Google Docs tools`);
        if (tools.length > 0) {
          console.log("First tool:", JSON.stringify(tools[0], null, 2));
        }
      }

      // TEST 4: Search with generic query (no appFilter)
      console.log("\n[TEST 4] Searching with generic query: 'get my emails'...");
      const genericSearchResult = await appIntegrationsHandler(
        { ...ctx, userId } as any,
        {
          action: "search",
          taskDescription: "get my emails",
        }
      );

      console.log("Generic search result:", JSON.stringify(genericSearchResult, null, 2));

      if (genericSearchResult.success) {
        const tools = (genericSearchResult.data as any)?.tools || [];
        console.log(`Found ${tools.length} tools with generic query`);
        if (tools.length > 0) {
          console.log("First tool:", JSON.stringify(tools[0], null, 2));
        }
      }

      // TEST 5: Check raw MCP response
      console.log("\n[TEST 5] Testing raw ToolRouterClient...");
      const session = await ctx.runQuery(api.toolRouter.sessions.getByUserId, { userId });

      if (session) {
        console.log("Session found:", session.sessionId);

        const { ToolRouterClient } = await import("../lib/toolRouterClient");
        const client = new ToolRouterClient(session.sessionUrl);
        await client.connect();

        const rawResult = await client.searchTools("send email", { toolkits: ["gmail"] });
        console.log("Raw ToolRouter search result:", JSON.stringify(rawResult, null, 2));

        await client.disconnect();
      } else {
        console.log("No session found for user");
      }

      console.log("\n=== ToolRouter Test Completed ===");

      return { success: true, message: "Test completed - check logs above" };
    } catch (error) {
      console.error("\n=== ToolRouter Test FAILED ===");
      console.error("Error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error"
      };
    }
  }
});
