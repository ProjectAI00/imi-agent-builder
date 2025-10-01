import { betterAuth } from "better-auth";
import { nextCookies } from "better-auth/next-js";

// Simple in-memory store for development/Vercel
const users = new Map();
const sessions = new Map();
const accounts = new Map();

export const auth = betterAuth({
  plugins: [nextCookies()],
  database: {
    async create({ model, data }: any) {
      const id = Math.random().toString(36);
      const record = { id, ...data, createdAt: Date.now(), updatedAt: Date.now() };

      if (model === "user") users.set(id, record);
      else if (model === "session") sessions.set(id, record);
      else if (model === "account") accounts.set(id, record);

      return record;
    },
    async findOne({ model, where }: any) {
      let store = model === "user" ? users : model === "session" ? sessions : accounts;

      for (const [id, record] of store) {
        const matches = Object.entries(where).every(([key, val]: any) =>
          record[key] === (val.value || val)
        );
        if (matches) return record;
      }
      return null;
    },
    async findMany() { return []; },
    async update({ model, where, data }: any) {
      let store = model === "user" ? users : model === "session" ? sessions : accounts;

      for (const [id, record] of store) {
        const matches = Object.entries(where).every(([key, val]: any) =>
          record[key] === (val.value || val)
        );
        if (matches) {
          const updated = { ...record, ...data, updatedAt: Date.now() };
          store.set(id, updated);
          return updated;
        }
      }
      return null;
    },
    async delete({ model, where }: any) {
      let store = model === "user" ? users : model === "session" ? sessions : accounts;

      for (const [id, record] of store) {
        const matches = Object.entries(where).every(([key, val]: any) =>
          record[key] === (val.value || val)
        );
        if (matches) {
          store.delete(id);
          return true;
        }
      }
      return false;
    },
  } as any,
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