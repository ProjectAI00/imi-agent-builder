import { v } from "convex/values";
import { action } from "../_generated/server";

/**
 * Bridge action to expose the appIntegrations handler for external orchestrators.
 * Supports `search`, `execute`, `check_connections`, and `initiate_connection`.
 */
export const run = action({
  args: {
    userId: v.string(),
    action: v.union(
      v.literal("search"),
      v.literal("execute"),
      v.literal("check_connections"),
      v.literal("initiate_connection")
    ),
    taskDescription: v.optional(v.string()),
    appFilter: v.optional(v.array(v.string())),
    appName: v.optional(v.string()),
    toolSlug: v.optional(v.string()),
    toolArguments: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const { appIntegrationsHandler } = await import("../tools/appIntegrations");
    const { userId, ...rest } = args;

    const result = await appIntegrationsHandler(
      { ...ctx, userId } as any,
      rest as any
    );

    return result;
  },
});

