import { query } from "../_generated/server";

// Check what users exist in authUsers table
export const listAuthUsers = query({
  handler: async (ctx) => {
    const users = await ctx.db.query("authUsers").collect();
    return users.map(user => ({
      id: user._id,
      email: user.email,
      name: user.name,
      createdAt: new Date(user.createdAt).toISOString()
    }));
  },
});

// Check what users exist in old users table
export const listLegacyUsers = query({
  handler: async (ctx) => {
    const users = await ctx.db.query("users").collect();
    return users.map(user => ({
      id: user._id,
      username: user.username,
      email: user.email,
      createdAt: new Date(user.createdAt).toISOString()
    }));
  },
});

