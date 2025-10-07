import { query } from "../_generated/server";
import { v } from "convex/values";

/**
 * Debug query to check Tool Router sessions and their state
 *
 * Usage: Run this in Convex dashboard to see all sessions
 */
export const listAllSessions = query({
  args: {},
  handler: async (ctx) => {
    const sessions = await ctx.db.query("toolRouterSessions").collect();

    return sessions.map(session => ({
      userId: session.userId,
      sessionId: session.sessionId,
      sessionUrl: session.sessionUrl,
      connectedToolkits: session.connectedToolkits,
      createdAt: new Date(session.createdAt).toISOString(),
      lastActiveAt: session.lastActiveAt ? new Date(session.lastActiveAt).toISOString() : null,
      ageInHours: Math.floor((Date.now() - session.createdAt) / (1000 * 60 * 60)),
      timeSinceLastActive: session.lastActiveAt
        ? Math.floor((Date.now() - session.lastActiveAt) / (1000 * 60 * 60)) + " hours ago"
        : "never active",
    }));
  },
});

export const getSessionByUser = query({
  args: { userId: v.string() },
  handler: async (ctx, { userId }) => {
    const session = await ctx.db
      .query("toolRouterSessions")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .first();

    if (!session) {
      return { found: false, message: "No session found for this user" };
    }

    return {
      found: true,
      userId: session.userId,
      sessionId: session.sessionId,
      sessionUrl: session.sessionUrl,
      connectedToolkits: session.connectedToolkits,
      createdAt: new Date(session.createdAt).toISOString(),
      lastActiveAt: session.lastActiveAt ? new Date(session.lastActiveAt).toISOString() : null,
      ageInHours: Math.floor((Date.now() - session.createdAt) / (1000 * 60 * 60)),
      timeSinceLastActive: session.lastActiveAt
        ? Math.floor((Date.now() - session.lastActiveAt) / (1000 * 60 * 60)) + " hours ago"
        : "never active",
      isExpired: (Date.now() - (session.lastActiveAt || session.createdAt)) > (7 * 24 * 60 * 60 * 1000),
    };
  },
});

/**
 * Check if Composio session is still valid by trying to connect to it
 */
export const testComposioSession = query({
  args: { userId: v.string() },
  handler: async (ctx, { userId }) => {
    const session = await ctx.db
      .query("toolRouterSessions")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .first();

    if (!session) {
      return {
        status: "no_session",
        message: "No Tool Router session found in database"
      };
    }

    return {
      status: "session_found",
      sessionId: session.sessionId,
      sessionUrl: session.sessionUrl,
      connectedToolkits: session.connectedToolkits || [],
      toolkitCount: (session.connectedToolkits || []).length,
      message: `Session exists with ${(session.connectedToolkits || []).length} connected toolkits`,
      details: {
        createdAt: new Date(session.createdAt).toISOString(),
        lastActiveAt: session.lastActiveAt ? new Date(session.lastActiveAt).toISOString() : null,
        ageInDays: Math.floor((Date.now() - session.createdAt) / (1000 * 60 * 60 * 24)),
      }
    };
  },
});
