import { mutation, query } from "../_generated/server";
import { v } from "convex/values";

// Create user
export const createUser = mutation({
  args: {
    username: v.string(),
    email: v.string(),
    passwordHash: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await ctx.db.insert("users", {
      username: args.username,
      userId: args.username,
      passwordHash: args.passwordHash,
      email: args.email,
      createdAt: Date.now(),
      lastActive: Date.now(),
    });
    return userId;
  },
});

// Get user by email
export const getUserByEmail = query({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("email"), args.email))
      .first();
  },
});

// Get user by username
export const getUserByUsername = query({
  args: { username: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("users")
      .withIndex("by_username", (q) => q.eq("username", args.username))
      .first();
  },
});

// Create session
export const createSession = mutation({
  args: {
    userId: v.string(),
    token: v.string(),
    expiresAt: v.number(),
  },
  handler: async (ctx, args) => {
    const sessionId = await ctx.db.insert("sessions", {
      userId: args.userId,
      token: args.token,
      expiresAt: args.expiresAt,
    });
    return sessionId;
  },
});

// Get session by token
export const getSessionByToken = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("sessions")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .first();
  },
});

// Delete session
export const deleteSession = mutation({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const session = await ctx.db
      .query("sessions")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .first();

    if (session) {
      await ctx.db.delete(session._id);
    }
  },
});
