import { action } from "../_generated/server";
import { v } from "convex/values";
import { api } from "../_generated/api";

/**
 * Cleanup utility to list and optionally remove stale INITIATED connections
 *
 * Usage from Convex dashboard:
 * - List only: npx convex run debug/cleanupStaleConnections:listStaleConnections '{"userId":"advicebyaimar"}'
 * - Delete stale: npx convex run debug/cleanupStaleConnections:deleteStaleConnections '{"userId":"advicebyaimar","olderThanMinutes":10}'
 */

export const listStaleConnections = action({
  args: {
    userId: v.string(),
    olderThanMinutes: v.optional(v.number()),
  },
  handler: async (ctx, { userId, olderThanMinutes = 10 }) => {
    const composioApiKey = process.env.COMPOSIO_API_KEY;
    if (!composioApiKey) {
      return { error: "COMPOSIO_API_KEY not configured" };
    }

    try {
      const response = await fetch(
        `https://backend.composio.dev/api/v3/connected_accounts?user_ids=${userId}`,
        { headers: { "x-api-key": composioApiKey } }
      );

      if (!response.ok) {
        return { error: `API error: ${response.status}` };
      }

      const data = await response.json();
      const cutoffTime = Date.now() - (olderThanMinutes * 60 * 1000);

      const staleConnections = data.items?.filter((conn: any) => {
        if (conn.status !== "INITIATED") return false;
        const createdAt = new Date(conn.created_at).getTime();
        return createdAt <= cutoffTime;
      }) || [];

      const groupedByApp = staleConnections.reduce((acc: any, conn: any) => {
        const app = conn.toolkit?.slug || "unknown";
        if (!acc[app]) acc[app] = [];
        acc[app].push({
          id: conn.id,
          created_at: conn.created_at,
          age_minutes: Math.floor((Date.now() - new Date(conn.created_at).getTime()) / (60 * 1000)),
          redirect_url: conn.data?.redirectUrl,
        });
        return acc;
      }, {});

      return {
        total_stale: staleConnections.length,
        older_than_minutes: olderThanMinutes,
        by_app: groupedByApp,
        summary: Object.entries(groupedByApp).map(([app, conns]: [string, any]) =>
          `${app}: ${conns.length} stale connection(s)`
        ),
      };
    } catch (error) {
      return { error: error instanceof Error ? error.message : "Unknown error" };
    }
  },
});

/**
 * Note: Composio v3 API doesn't provide a direct DELETE endpoint for connected_accounts.
 * Stale INITIATED connections will be automatically ignored by our deduplication logic.
 * This function documents the stale connections but cannot delete them.
 *
 * To manually clean up via Composio dashboard:
 * https://app.composio.dev/your_project/connected_accounts
 */
export const documentStaleConnections = action({
  args: {
    userId: v.string(),
    olderThanMinutes: v.optional(v.number()),
  },
  handler: async (ctx, { userId, olderThanMinutes = 10 }): Promise<{
    total_stale?: number;
    older_than_minutes?: number;
    by_app?: Record<string, any>;
    summary?: string[];
    error?: string;
    note: string;
  }> => {
    // First, list the stale connections
    const staleList = await ctx.runAction(api.debug.cleanupStaleConnections.listStaleConnections, {
      userId,
      olderThanMinutes,
    });

    return {
      ...staleList,
      note: "Composio v3 API does not support programmatic deletion. These connections are ignored by our deduplication logic. To manually delete, visit: https://app.composio.dev",
    };
  },
});
