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
    userId: v.union(v.id("authUsers"), v.string()),
    email: v.optional(v.string()),
    emailVerified: v.optional(v.boolean()),
    name: v.optional(v.string()),
    image: v.optional(v.string()),
  },
  handler: async (ctx, { userId, ...updates }) => {
    // Convert string ID to proper Convex ID if needed
    const id = typeof userId === 'string' && userId.startsWith('k')
      ? userId as any
      : userId;
      
    await ctx.db.patch(id, {
      ...updates,
      updatedAt: Date.now(),
    });
    return id;
  },
});

// Create session
export const createSession = mutation({
  args: {
    userId: v.union(v.id("authUsers"), v.string()),
    token: v.string(),
    expiresAt: v.number(),
    ipAddress: v.optional(v.string()),
    userAgent: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    
    // Convert string ID to proper Convex ID if needed
    const userId = typeof args.userId === 'string' && args.userId.startsWith('k')
      ? args.userId as any
      : args.userId;
    
    const sessionId = await ctx.db.insert("authSessions", {
      ...args,
      userId,
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

    // Get user data - handle both string and ID types
    const userId = typeof session.userId === 'string' && session.userId.startsWith('k')
      ? session.userId as any
      : session.userId;
    const user = await ctx.db.get(userId);
    if (!user) return null;

    return {
      session,
      user,
    };
  },
});

// Delete session
export const deleteSession = mutation({
  args: { sessionId: v.union(v.id("authSessions"), v.string()) },
  handler: async (ctx, { sessionId }) => {
    // Convert string ID to proper Convex ID if needed
    const id = typeof sessionId === 'string' && sessionId.startsWith('j')
      ? sessionId as any
      : sessionId;
      
    await ctx.db.delete(id);
    return true;
  },
});

// Create account
export const createAccount = mutation({
  args: {
    userId: v.union(v.id("authUsers"), v.string()),
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
    
    // Convert string ID to proper Convex ID if needed
    const userId = typeof args.userId === 'string' && args.userId.startsWith('k')
      ? args.userId as any
      : args.userId;
    
    const accountId = await ctx.db.insert("authAccounts", {
      ...args,
      userId,
      createdAt: now,
      updatedAt: now,
    });
    return accountId;
  },
});

// Find account by userId and providerId
export const findAccount = query({
  args: {
    userId: v.union(v.id("authUsers"), v.string()),
    providerId: v.string(),
  },
  handler: async (ctx, { userId, providerId }) => {
    // Convert string ID to proper Convex ID if needed
    const id = typeof userId === 'string' && userId.startsWith('k')
      ? userId as any
      : userId;
      
    const accounts = await ctx.db
      .query("authAccounts")
      .withIndex("by_userId", (q) => q.eq("userId", id))
      .collect();

    return accounts.find(a => a.providerId === providerId) || null;
  },
});
