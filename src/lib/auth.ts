import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import path from "path";
import fs from "fs";
import { user, session, account, verification } from "./auth-schema";

// Create .data directory if it doesn't exist
const authDataDir = path.join(process.cwd(), ".data");
if (!fs.existsSync(authDataDir)) {
  fs.mkdirSync(authDataDir, { recursive: true });
}
const authDbPath = path.join(authDataDir, "auth.db");

// Create Drizzle database with SQLite
const sqlite = new Database(authDbPath);
const db = drizzle(sqlite);

export const auth = betterAuth({
  plugins: [nextCookies()],
  database: drizzleAdapter(db, {
    provider: "sqlite",
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
      maxAge: 5 * 60 * 1000, // 5 minutes
    },
  },
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
  },
});