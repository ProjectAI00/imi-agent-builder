import { v } from "convex/values";
import { mutation, query } from "../_generated/server";

// Create user
export const createUser = mutation({
  args: {
    email: v.string(),
    emailVerified: v.boolean(),
    name: v.optional(v.string()),
    image: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const userId = await ctx.db.insert("authUsers", {
      ...args,
      createdAt: now,
      updatedAt: now,
    });
    return userId;
  },
});

// Find user by email
export const findUserByEmail = query({
  args: { email: v.string() },
  handler: async (ctx, { email }) => {
    const user = await ctx.db
      .query("authUsers")
      .withIndex("by_email", (q) => q.eq("email", email))
      .first();
    return user;
  },
});

// Update user
export const updateUser = mutation({
  args: {
    userId: v.id("authUsers"),
    email: v.optional(v.string()),
    emailVerified: v.optional(v.boolean()),
    name: v.optional(v.string()),
    image: v.optional(v.string()),
  },
  handler: async (ctx, { userId, ...updates }) => {
    await ctx.db.patch(userId, {
      ...updates,
      updatedAt: Date.now(),
    });
    return userId;
  },
});

// Create session
export const createSession = mutation({
  args: {
    userId: v.id("authUsers"),
    token: v.string(),
    expiresAt: v.number(),
    ipAddress: v.optional(v.string()),
    userAgent: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const sessionId = await ctx.db.insert("authSessions", {
      ...args,
      createdAt: now,
      updatedAt: now,
    });
    return sessionId;
  },
});

// Find session by token
export const findSessionByToken = query({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const session = await ctx.db
      .query("authSessions")
      .withIndex("by_token", (q) => q.eq("token", token))
      .first();

    if (!session) return null;

    // Get user data
    const user = await ctx.db.get(session.userId);
    if (!user) return null;

    return {
      session,
      user,
    };
  },
});

// Delete session
export const deleteSession = mutation({
  args: { sessionId: v.id("authSessions") },
  handler: async (ctx, { sessionId }) => {
    await ctx.db.delete(sessionId);
    return true;
  },
});

// Create account
export const createAccount = mutation({
  args: {
    userId: v.id("authUsers"),
    accountId: v.string(),
    providerId: v.string(),
    accessToken: v.optional(v.string()),
    refreshToken: v.optional(v.string()),
    expiresAt: v.optional(v.number()),
    scope: v.optional(v.string()),
    password: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const accountId = await ctx.db.insert("authAccounts", {
      ...args,
      createdAt: now,
      updatedAt: now,
    });
    return accountId;
  },
});

// Find account by userId and providerId
export const findAccount = query({
  args: {
    userId: v.id("authUsers"),
    providerId: v.string(),
  },
  handler: async (ctx, { userId, providerId }) => {
    const accounts = await ctx.db
      .query("authAccounts")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .collect();

    return accounts.find(a => a.providerId === providerId) || null;
  },
});
