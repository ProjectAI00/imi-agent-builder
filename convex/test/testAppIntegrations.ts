import { internalAction } from "../_generated/server";
import { v } from "convex/values";

/**
 * Test script to diagnose app integrations issues
 * Call this via Convex dashboard or CLI to see exactly what's happening
 */
export const diagnose = internalAction({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const { userId } = args;
    const results: Record<string, any> = {};

    console.log("=== App Integrations Diagnostic Test ===");
    console.log("Testing for userId:", userId);

    // Test 1: Check environment variables
    console.log("\n[Test 1] Environment Variables");
    const composioApiKey = process.env.COMPOSIO_API_KEY;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL;
    
    results.env = {
      hasComposioKey: !!composioApiKey,
      composioKeyLength: composioApiKey?.length || 0,
      composioKeyPrefix: composioApiKey?.substring(0, 10) + "...",
      appUrl: appUrl || "not set",
    };
    
    console.log("- COMPOSIO_API_KEY:", results.env.hasComposioKey ? "✓ Set" : "✗ Missing");
    console.log("- Key length:", results.env.composioKeyLength);
    console.log("- Key prefix:", results.env.composioKeyPrefix);
    console.log("- NEXT_PUBLIC_APP_URL:", results.env.appUrl);

    if (!composioApiKey) {
      console.error("✗ COMPOSIO_API_KEY is not set!");
      return {
        success: false,
        error: "COMPOSIO_API_KEY environment variable is missing",
        results,
      };
    }

    // Test 2: Check if user has existing session
    console.log("\n[Test 2] Check Existing Session");
    const { api } = await import("../_generated/api");
    const existingSession = await ctx.runQuery(api.toolRouter.sessions.getByUserId, { userId });
    
    results.existingSession = {
      exists: !!existingSession,
      sessionId: existingSession?.sessionId,
      sessionUrl: existingSession?.sessionUrl,
      connectedToolkits: existingSession?.connectedToolkits,
    };
    
    console.log("- Session exists:", results.existingSession.exists ? "✓ Yes" : "✗ No");
    if (existingSession) {
      console.log("- Session ID:", existingSession.sessionId);
      console.log("- Connected toolkits:", existingSession.connectedToolkits);
    }

    // Test 3: Try to create a new session
    console.log("\n[Test 3] Create ToolRouter Session");
    try {
      const response = await fetch(
        "https://backend.composio.dev/api/v3/labs/tool_router/session",
        {
          method: "POST",
          headers: {
            "x-api-key": composioApiKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            user_id: userId,
          }),
        }
      );

      results.sessionCreation = {
        status: response.status,
        ok: response.ok,
      };

      console.log("- HTTP Status:", response.status);
      console.log("- Response OK:", response.ok);

      if (!response.ok) {
        const errorText = await response.text();
        results.sessionCreation.error = errorText;
        console.error("✗ Session creation failed:", errorText);
        return {
          success: false,
          error: `Composio API error: ${response.status} ${errorText}`,
          results,
        };
      }

      const sessionData = await response.json();
      results.sessionCreation.data = sessionData;
      
      console.log("✓ Session created successfully!");
      console.log("- Session ID:", sessionData.session_id);
      console.log("- Session URL:", sessionData.url);

      // Test 4: Try to connect to MCP
      console.log("\n[Test 4] Connect to MCP Client");
      try {
        const { ToolRouterClient } = await import("../lib/toolRouterClient");
        const client = new ToolRouterClient(sessionData.url);
        await client.connect();
        
        console.log("✓ MCP client connected successfully!");
        results.mcpConnection = { success: true };

        // Test 5: Try to call COMPOSIO_MANAGE_CONNECTIONS
        console.log("\n[Test 5] Test COMPOSIO_MANAGE_CONNECTIONS");
        try {
          const connectionResult = await client.manageConnections(["gmail"]);
          results.manageConnections = {
            success: true,
            response: connectionResult,
          };
          
          console.log("✓ COMPOSIO_MANAGE_CONNECTIONS succeeded!");
          console.log("- Response:", JSON.stringify(connectionResult, null, 2));

          await client.disconnect();
        } catch (error) {
          results.manageConnections = {
            success: false,
            error: error instanceof Error ? error.message : String(error),
          };
          console.error("✗ COMPOSIO_MANAGE_CONNECTIONS failed:", error);
        }
      } catch (error) {
        results.mcpConnection = {
          success: false,
          error: error instanceof Error ? error.message : String(error),
        };
        console.error("✗ MCP connection failed:", error);
      }

      console.log("\n=== Diagnostic Complete ===");
      return {
        success: true,
        results,
      };
    } catch (error) {
      console.error("✗ Test failed with error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        results,
      };
    }
  },
});

