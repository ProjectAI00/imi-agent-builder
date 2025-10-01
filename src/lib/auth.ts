import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { user, session, account, verification } from "./auth-schema";

// Use in-memory database for Vercel serverless
let db: any;

if (process.env.VERCEL) {
  // On Vercel, use a minimal in-memory setup (sessions won't persist across requests)
  // In production, you should use a proper database like Postgres/Neon
  const Database = require("better-sqlite3");
  const { drizzle } = require("drizzle-orm/better-sqlite3");
  const sqlite = new Database(":memory:");
  db = drizzle(sqlite);

  // Create tables in memory
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS user (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      emailVerified INTEGER DEFAULT 0,
      name TEXT,
      createdAt INTEGER NOT NULL,
      updatedAt INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS session (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      expiresAt INTEGER NOT NULL,
      token TEXT NOT NULL UNIQUE,
      createdAt INTEGER NOT NULL,
      updatedAt INTEGER NOT NULL,
      FOREIGN KEY (userId) REFERENCES user(id)
    );
    CREATE TABLE IF NOT EXISTS account (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      providerId TEXT NOT NULL,
      providerUserId TEXT NOT NULL,
      accessToken TEXT,
      refreshToken TEXT,
      expiresAt INTEGER,
      createdAt INTEGER NOT NULL,
      updatedAt INTEGER NOT NULL,
      FOREIGN KEY (userId) REFERENCES user(id)
    );
    CREATE TABLE IF NOT EXISTS verification (
      id TEXT PRIMARY KEY,
      identifier TEXT NOT NULL,
      value TEXT NOT NULL,
      expiresAt INTEGER NOT NULL,
      createdAt INTEGER NOT NULL,
      updatedAt INTEGER NOT NULL
    );
  `);
} else {
  // Local development: use file-based SQLite
  const Database = require("better-sqlite3");
  const { drizzle } = require("drizzle-orm/better-sqlite3");
  const path = require("path");
  const fs = require("fs");

  const authDataDir = path.join(process.cwd(), ".data");
  if (!fs.existsSync(authDataDir)) {
    fs.mkdirSync(authDataDir, { recursive: true });
  }
  const authDbPath = path.join(authDataDir, "auth.db");
  const sqlite = new Database(authDbPath);
  db = drizzle(sqlite);
}

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