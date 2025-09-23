import { betterAuth } from "better-auth";

function getDatabase() {
  if (process.env.DATABASE_URL) {
    // Production: Use Neon database
    const { neon } = require("@neondatabase/serverless");
    return {
      provider: "postgresql",
      db: neon(process.env.DATABASE_URL),
    };
  } else {
    // Development: Use SQLite
    const Database = require("better-sqlite3");
    const path = require("path");
    const fs = require("fs");
    
    const authDataDir = path.join(process.cwd(), ".data");
    if (!fs.existsSync(authDataDir)) {
      fs.mkdirSync(authDataDir, { recursive: true });
    }
    const authDbPath = path.join(authDataDir, "auth.db");
    
    return {
      provider: "sqlite",
      db: new Database(authDbPath),
    };
  }
}

export const auth = betterAuth({
  database: getDatabase(),
  secret: process.env.BETTER_AUTH_SECRET || "your-secret-key-change-this-in-production-must-be-32-chars-long",
  baseURL: process.env.BETTER_AUTH_URL || process.env.VERCEL_URL || "http://localhost:3000",
  session: {
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60 * 1000, // 5 minutes
    },
  },
  // Pinterest OAuth handled separately via custom API routes
});