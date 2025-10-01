import { betterAuth } from "better-auth";
import { nextCookies } from "better-auth/next-js";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { user, session, account, verification } from "./auth-schema";

const sql = neon(process.env.DATABASE_URL!);
const db = drizzle(sql);

export const auth = betterAuth({
  plugins: [nextCookies()],
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user,
      session,
      account,
      verification,
    },
  }),
  secret: process.env.BETTER_AUTH_SECRET || "your-secret-key-change-this-in-production-must-be-32-chars-long",
  baseURL: process.env.BETTER_AUTH_URL || "http://localhost:3000",
  session: {
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60 * 1000,
    },
  },
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
  },
});