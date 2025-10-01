import { betterAuth } from "better-auth";
import { nextCookies } from "better-auth/next-js";
import { createConvexAdapter } from "./convex-better-auth-adapter";

export const auth = betterAuth({
  plugins: [nextCookies()],
  database: createConvexAdapter() as any,
  secret: process.env.BETTER_AUTH_SECRET || "your-secret-key-change-this-in-production-must-be-32-chars-long",
  baseURL: process.env.BETTER_AUTH_URL || "http://localhost:3000",
  session: {
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60 * 1000, // 5 minutes
    },
  },
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
  },
});