import { v } from "convex/values";
import { mutation, query } from "../_generated/server";

/**
 * User Management Functions
 */

/**
 * Get or create a user by userId
 */
export const getOrCreate = mutation({
  args: {
    userId: v.string(),
    phoneNumber: v.optional(v.string()),
    email: v.optional(v.string()),
    preferredAgent: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { userId, phoneNumber, email, preferredAgent = "casual" } = args;

    // Check if user exists
    const existing = await ctx.db
      .query("users")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .first();

    if (existing) {
      // Update last active
      await ctx.db.patch(existing._id, {
        lastActive: Date.now(),
      });

      return existing;
    }

    // Create new user
    const newUserId = await ctx.db.insert("users", {
      username: userId, // Use userId as username for non-auth users
      userId,
      passwordHash: "", // Empty for non-auth created users
      phoneNumber,
      email,
      preferredAgent,
      createdAt: Date.now(),
      lastActive: Date.now(),
    });

    const newUser = await ctx.db.get(newUserId);
    return newUser!;
  },
});

/**
 * Get user by phone number (for iMessage)
 */
export const getByPhoneNumber = query({
  args: {
    phoneNumber: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_phoneNumber", (q) => q.eq("phoneNumber", args.phoneNumber))
      .first();

    return user;
  },
});

/**
 * Update user preferences
 */
export const updatePreferences = mutation({
  args: {
    userId: v.string(),
    preferredAgent: v.optional(v.string()),
    preferences: v.optional(v.object({
      language: v.optional(v.string()),
      notifications: v.optional(v.boolean()),
    })),
  },
  handler: async (ctx, args) => {
    const { userId, preferredAgent, preferences } = args;

    const user = await ctx.db
      .query("users")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .first();

    if (!user) {
      throw new Error("User not found");
    }

    await ctx.db.patch(user._id, {
      ...(preferredAgent !== undefined && { preferredAgent }),
      ...(preferences !== undefined && { preferences }),
      lastActive: Date.now(),
    });
  },
});