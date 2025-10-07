import { createTool } from "@convex-dev/agent";
import { z } from "zod";
import { ActionCtx } from "../_generated/server";
import { api } from "../_generated/api";

/**
 * App Integrations Tool
 *
 * Provides access to 500+ app integrations (Gmail, Slack, Google Docs, etc.)
 * through a natural interface without exposing implementation details.
 */

// Export the handler function separately so it can be called directly from workflows
export async function appIntegrationsHandler(
  ctx: ActionCtx & { userId?: string },
  args: {
    action: "search" | "execute" | "check_connections" | "initiate_connection";
    taskDescription?: string;
    appFilter?: string[];
    appName?: string;
    toolSlug?: string;
    toolArguments?: Record<string, any>;
  },
): Promise<{
  success: boolean;
  message: string;
  data?: unknown;
  authRequired?: {
    app: string;
    authUrl: string;
    instructions: string;
  };
}> {
  try {
    // Get userId from context (automatically provided by Agent component)
    const userId = ctx.userId;

    if (!userId) {
      return {
        success: false,
        message:
          "User ID is required but not found in context. This is a system error.",
      };
    }

    // Get ToolRouter session for this user
    let session = await ctx.runQuery(api.toolRouter.sessions.getByUserId, {
      userId,
    });

    // Check if existing session is expired (older than 7 days)
    const sessionMaxAge = 7 * 24 * 60 * 60 * 1000; // 7 days
    const isSessionExpired =
      session &&
      Date.now() - (session.lastActiveAt || session.createdAt) > sessionMaxAge;

    if (isSessionExpired) {
      console.log(
        "[App Integrations] Session expired, creating new session for user:",
        userId,
      );
      session = null; // Force new session creation
    }

    // If no session exists, create one automatically (lazy initialization)
    if (!session) {
      console.log(
        "[App Integrations] No session found, creating new ToolRouter session for user:",
        userId,
      );

      const composioApiKey = process.env.COMPOSIO_API_KEY;
      if (!composioApiKey) {
        return {
          success: false,
          message: "Composio API key not configured on the server",
        };
      }

      try {
        // Create a new ToolRouter session via Composio API v3
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
              toolkits: ["googledocs", "gmail", "notion", "slack"], // Specify toolkits upfront
              config: {
                // Use project's default auth configs with custom branding
                use_default_auth_configs: true,
                // Set callback URL to our app
                callback_url: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/composio/callback`,
              },
            }),
          },
        );

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`[App Integrations] Failed to create session:`, {
            status: response.status,
            statusText: response.statusText,
            error: errorText,
          });
          return {
            success: false,
            message: `Failed to initialize app integrations: ${response.status} - ${errorText}`,
          };
        }

        const sessionData = await response.json();
        console.log(
          "[App Integrations] Session created successfully:",
          sessionData,
        );

        // Store the session in Convex database with upsert logic (handles race conditions)
        // The mutation will check again if session exists and update if found
        await ctx.runMutation(api.toolRouter.sessions.create, {
          userId,
          sessionId: sessionData.session_id,
          sessionUrl: sessionData.chat_session_mcp_url || sessionData.url,
          connectedToolkits: [],
          createdAt: Date.now(),
          lastActiveAt: Date.now(),
        });

        // Fetch the session (either newly created or existing from race condition)
        session = await ctx.runQuery(api.toolRouter.sessions.getByUserId, {
          userId,
        });

        if (!session) {
          return {
            success: false,
            message: "Failed to retrieve the newly created session",
          };
        }

        console.log("[App Integrations] Session ready:", session.sessionId);
      } catch (error) {
        console.error("[App Integrations] Error creating session:", error);
        return {
          success: false,
          message: `Failed to initialize app integrations: ${error instanceof Error ? error.message : "Unknown error"}`,
        };
      }
    }

    // Import ToolRouterClient dynamically to use in action context
    const { ToolRouterClient } = await import("../lib/toolRouterClient");
    const client = new ToolRouterClient(session.sessionUrl);
    await client.connect();

    // Sync connections from Composio with 60-second cache to avoid excessive API calls
    const now = Date.now();
    const lastSync = session.lastActiveAt || 0;
    const cacheDuration = 60 * 1000; // 60 seconds
    const shouldSync = now - lastSync > cacheDuration;

    if (shouldSync) {
      try {
        const composioApiKey = process.env.COMPOSIO_API_KEY;
        if (composioApiKey) {
          const connResponse = await fetch(
            `https://backend.composio.dev/api/v3/connected_accounts?user_ids=${userId}`,
            { headers: { "x-api-key": composioApiKey } },
          );

          if (connResponse.ok) {
            const connections = await connResponse.json();
            const connectedToolkits =
              connections.items
                ?.filter(
                  (conn: any) =>
                    conn.status === "ACTIVE" || conn.status === "active",
                )
                .map(
                  (conn: any) =>
                    conn.toolkit?.slug ||
                    conn.appName ||
                    conn.appUniqueId ||
                    conn.integration,
                )
                .filter(Boolean) || [];

            // Update DB if connections changed
            if (
              connectedToolkits.length > 0 &&
              JSON.stringify(connectedToolkits) !==
                JSON.stringify(session.connectedToolkits)
            ) {
              await ctx.runMutation(api.toolRouter.sessions.updateToolkits, {
                userId,
                toolkits: connectedToolkits,
              });
              session.connectedToolkits = connectedToolkits; // Update local copy
              console.log(
                "[App Integrations] Synced connections:",
                connectedToolkits,
              );
            }
          }
        }
      } catch (syncError) {
        console.warn(
          "[App Integrations] Failed to sync connections:",
          syncError,
        );
        // Continue with existing session data
      }
    } else {
      console.log(
        "[App Integrations] Using cached connections (synced",
        Math.round((now - lastSync) / 1000),
        "seconds ago)",
      );
    }

    switch (args.action) {
      case "search": {
        if (!args.taskDescription) {
          return {
            success: false,
            message: "taskDescription is required for search action",
          };
        }

        const results = await client.searchTools(args.taskDescription, {
          toolkits: args.appFilter,
        });

        // Parse the ToolRouter response which comes as { type: "text", text: "{...}" }
        let parsedResults = results;
        if (
          results &&
          typeof results === "object" &&
          (results as any).type === "text" &&
          (results as any).text
        ) {
          try {
            parsedResults = JSON.parse((results as any).text);
          } catch (e) {
            console.warn(
              "[App Integrations] Failed to parse search results:",
              e,
            );
          }
        }

        return {
          success: true,
          message: `Found available actions for: ${args.taskDescription}`,
          data: parsedResults,
        };
      }

      case "execute": {
        if (!args.toolSlug || !args.toolArguments) {
          return {
            success: false,
            message:
              "toolSlug and toolArguments are required for execute action",
          };
        }

        try {
          const results = await client.executeTools([
            {
              tool_slug: args.toolSlug,
              arguments: args.toolArguments,
            },
          ]);

          return {
            success: true,
            message: "Action executed successfully",
            data: results,
          };
        } catch (error) {
          // Check if this is an auth error
          const errorMessage =
            error instanceof Error ? error.message : String(error);

          if (
            errorMessage.includes("not connected") ||
            errorMessage.includes("authentication")
          ) {
            // Extract app name from tool slug (e.g., "GMAIL_SEND_EMAIL" -> "gmail")
            const appName = args.toolSlug.split("_")[0].toLowerCase();

            return {
              success: false,
              message: `The user needs to connect their ${appName} account first.`,
              authRequired: {
                app: appName,
                authUrl: "", // Client will need to handle getting auth URL
                instructions: `Please connect your ${appName} account to continue. I'll guide you through the setup.`,
              },
            };
          }

          throw error;
        }
      }

      case "check_connections": {
        try {
          // Query Composio API for actual connected integrations
          const composioApiKey = process.env.COMPOSIO_API_KEY;
          if (!composioApiKey) {
            return {
              success: false,
              message: "Composio API key not configured",
            };
          }

          // Get connections from Composio for this user
          const response = await fetch(
            `https://backend.composio.dev/api/v3/connected_accounts?user_ids=${userId}`,
            {
              headers: {
                "x-api-key": composioApiKey,
              },
            },
          );

          if (!response.ok) {
            console.error(
              "[App Integrations] Failed to fetch connections:",
              await response.text(),
            );
            // Fallback to local DB data
            return {
              success: true,
              message: `Connected to ${session.connectedToolkits?.length || 0} apps (from cache)`,
              data: {
                connectedApps: session.connectedToolkits || [],
                sessionActive: true,
              },
            };
          }

          const connections = await response.json();
          console.log(
            "[App Integrations] Fetched connections from Composio:",
            connections,
          );

          // Extract active connected toolkits
          const connectedToolkits =
            connections.items
              ?.filter(
                (conn: any) =>
                  conn.status === "ACTIVE" || conn.status === "active",
              )
              .map(
                (conn: any) =>
                  conn.toolkit?.slug ||
                  conn.appName ||
                  conn.appUniqueId ||
                  conn.integration,
              )
              .filter(Boolean) || [];

          // Update our database with actual connections
          if (
            connectedToolkits.length > 0 &&
            JSON.stringify(connectedToolkits) !==
              JSON.stringify(session.connectedToolkits)
          ) {
            await ctx.runMutation(api.toolRouter.sessions.updateToolkits, {
              userId,
              toolkits: connectedToolkits,
            });
            console.log(
              "[App Integrations] Updated connected toolkits in DB:",
              connectedToolkits,
            );
          }

          return {
            success: true,
            message: `Connected to ${connectedToolkits.length} apps`,
            data: {
              connectedApps: connectedToolkits,
              sessionActive: true,
              allConnections: connections.items || [],
            },
          };
        } catch (error) {
          console.error(
            "[App Integrations] Error checking connections:",
            error,
          );
          // Fallback to DB data
          return {
            success: true,
            message: `Connected to ${session.connectedToolkits?.length || 0} apps (from cache)`,
            data: {
              connectedApps: session.connectedToolkits || [],
              sessionActive: true,
            },
          };
        }
      }

      case "initiate_connection": {
        if (!args.appName) {
          return {
            success: false,
            message: "appName is required for initiate_connection action",
          };
        }

        try {
          // Normalize app name to lowercase for toolkit names (e.g., "gmail", "slack")
          const toolkitName = args.appName.toLowerCase();

          console.log(
            "[App Integrations] Initiating connection via Tool Router:",
            {
              toolkit: toolkitName,
              userId: userId,
            },
          );

          // DEDUPLICATION CHECK: Prevent duplicate connections
          // Check if user already has an ACTIVE or recent INITIATED connection for this app
          const composioApiKey = process.env.COMPOSIO_API_KEY;
          if (composioApiKey) {
            try {
              const existingConnResponse = await fetch(
                `https://backend.composio.dev/api/v3/connected_accounts?user_ids=${userId}`,
                { headers: { "x-api-key": composioApiKey } },
              );

              if (existingConnResponse.ok) {
                const existingConns = await existingConnResponse.json();
                const appConnections =
                  existingConns.items?.filter((conn: any) => {
                    const connApp = (
                      conn.toolkit?.slug ||
                      conn.appName ||
                      ""
                    ).toLowerCase();
                    return connApp === toolkitName;
                  }) || [];

                // Check for active connection
                const activeConn = appConnections.find(
                  (c: any) => c.status === "ACTIVE",
                );
                if (activeConn) {
                  return {
                    success: true,
                    message: `${args.appName} is already connected! No need to authenticate again.`,
                    data: {
                      alreadyConnected: true,
                      app: args.appName,
                      connectionId: activeConn.id,
                    },
                  };
                }

                // Check for recent INITIATED connections (within last 10 minutes)
                const recentInitiated = appConnections.filter((c: any) => {
                  if (c.status !== "INITIATED") return false;
                  const createdAt = new Date(c.created_at).getTime();
                  const tenMinutesAgo = Date.now() - 10 * 60 * 1000;
                  return createdAt > tenMinutesAgo;
                });

                if (recentInitiated.length > 0) {
                  const redirectUrl = recentInitiated[0].data?.redirectUrl;
                  if (redirectUrl) {
                    return {
                      success: true,
                      message: `Found existing authentication link for ${args.appName}: [Authenticate ${args.appName}](${redirectUrl})`,
                      data: {
                        connectionUrl: redirectUrl,
                        app: args.appName,
                        toolkit: toolkitName,
                        displayText: `Authenticate ${args.appName}`,
                        reused: true,
                      },
                    };
                  }
                }

                // Clean up old INITIATED connections (older than 10 minutes)
                const staleInitiated = appConnections.filter((c: any) => {
                  if (c.status !== "INITIATED") return false;
                  const createdAt = new Date(c.created_at).getTime();
                  const tenMinutesAgo = Date.now() - 10 * 60 * 1000;
                  return createdAt <= tenMinutesAgo;
                });

                if (staleInitiated.length > 0) {
                  console.log(
                    `[App Integrations] Found ${staleInitiated.length} stale INITIATED connections for ${toolkitName}, will be cleaned up`,
                  );
                  // Note: Composio doesn't have a delete endpoint in v3, so we just log for now
                  // These will be ignored in favor of the new connection
                }
              }
            } catch (dedupError) {
              console.warn(
                "[App Integrations] Deduplication check failed, continuing:",
                dedupError,
              );
              // Continue with connection attempt
            }
          }

          // Use COMPOSIO_MANAGE_CONNECTIONS to initiate the OAuth flow
          // Tool Router handles authentication internally via MCP
          const connectionResult = await client.manageConnections([
            toolkitName,
          ]);

          console.log(
            "[App Integrations] Tool Router connection response:",
            connectionResult,
          );

          // Tool Router returns connection status and auth URLs if needed
          // Parse the response to extract the OAuth URL
          let authUrl: string | null = null;

          // The response structure from COMPOSIO_MANAGE_CONNECTIONS (v3)
          if (connectionResult && typeof connectionResult === "object") {
            const result = connectionResult as any;

            // V3 returns: { type: 'text', text: '{"data":{"results":{"gmail":{"redirect_url":"..."}}}}'  }
            if (result.type === "text" && result.text) {
              try {
                const parsed = JSON.parse(result.text);
                // Extract redirect_url from the results
                if (parsed.data?.results) {
                  const toolkitResult = parsed.data.results[toolkitName];
                  if (toolkitResult?.redirect_url) {
                    authUrl = toolkitResult.redirect_url;
                  }
                }
              } catch (e) {
                console.warn(
                  "[App Integrations] Failed to parse text response:",
                  e,
                );
              }
            }

            // Fallback: check structured fields
            if (!authUrl && result.authUrl) {
              authUrl = result.authUrl;
            }
            if (!authUrl && result.redirectUrl) {
              authUrl = result.redirectUrl;
            }
            if (!authUrl && result.url) {
              authUrl = result.url;
            }
          }

          if (!authUrl) {
            // No auth URL means either already connected or auth not needed
            return {
              success: true,
              message: `${args.appName} is already connected or doesn't require OAuth`,
              data: {
                app: args.appName,
                toolkit: toolkitName,
                alreadyConnected: true,
                response: connectionResult,
              },
            };
          }

          return {
            success: true,
            message: `Click here to authenticate ${args.appName}: [Authenticate ${args.appName}](${authUrl})`,
            data: {
              connectionUrl: authUrl,
              app: args.appName,
              toolkit: toolkitName,
              // Return a clean display text for the UI
              displayText: `Authenticate ${args.appName}`,
              fullResponse: connectionResult,
            },
          };
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : String(error);
          console.error("[App Integrations] Connection error:", error);

          return {
            success: false,
            message: `Failed to initiate connection for ${args.appName}: ${errorMessage}`,
          };
        }
      }

      default: {
        return {
          success: false,
          message: `Unknown action: ${args.action}`,
        };
      }
    }
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    console.error("[App Integrations] Error:", errorMessage);

    return {
      success: false,
      message: `Failed to complete action: ${errorMessage}`,
    };
  }
}

// Create the tool using the exported handler
export const appIntegrations = createTool({
  description: `Connect to and interact with external apps like Gmail, Slack, Google Docs, Excel, Notion, and 500+ other services.

  Use this to:
  - Search for available actions (e.g., "send Gmail email", "create Google Doc", "post to Slack")
  - Execute actions on connected apps
  - Check which apps the user has connected

  The system handles authentication automatically - if a user needs to connect an app, you'll get instructions on how to guide them.

  Examples:
  - "search: send email via Gmail"
  - "search: create document in Google Docs"
  - "search: post message to Slack channel"
  - "execute: GMAIL_SEND_EMAIL with arguments"`,

  args: z.object({
    action: z.enum([
      "search",
      "execute",
      "check_connections",
      "initiate_connection",
    ]).describe(`
      - "search": Find available actions for a task
      - "execute": Run a specific action on an app
      - "check_connections": See which apps are connected
      - "initiate_connection": Get OAuth URL to connect a new app
    `),

    taskDescription: z.string().optional().describe(`
      For "search": Describe what you want to do (e.g., "send an email", "create a document")
      Not needed for "check_connections"
    `),

    appFilter: z.array(z.string()).optional().describe(`
      Optionally limit search to specific apps (e.g., ["gmail", "slack"])
    `),

    appName: z.string().optional().describe(`
      For "initiate_connection": The app to connect (e.g., "gmail", "slack", "notion")
    `),

    toolSlug: z.string().optional().describe(`
      For "execute": The specific tool identifier (e.g., "GMAIL_SEND_EMAIL")
      You get this from a "search" action first
    `),

    toolArguments: z.record(z.any()).optional().describe(`
      For "execute": The arguments needed for the tool
      The search results will tell you what arguments are required
    `),
  }),

  handler: appIntegrationsHandler,
});
