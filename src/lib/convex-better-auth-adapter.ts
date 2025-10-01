import { ConvexHttpClient } from "convex/browser";
import { api } from "../../convex/_generated/api";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export function createConvexAdapter() {
  return {
    id: "convex" as const,

    // Required: provide options for Better Auth
    options: {
      provider: "convex" as const,
    },

    async create({ model, data }: any) {
      console.log("[Convex Adapter] Creating:", model, data);
      const now = Date.now();

      try {
        if (model === "user") {
          const userId = await convex.mutation(api.auth.betterAuth.createUser, {
            email: data.email,
            emailVerified: data.emailVerified || false,
            name: data.name,
            image: data.image,
          });
          return { id: userId, ...data, createdAt: now, updatedAt: now };
        }

        if (model === "session") {
          const sessionId = await convex.mutation(api.auth.betterAuth.createSession, {
            userId: data.userId,
            token: data.token,
            expiresAt: data.expiresAt,
            ipAddress: data.ipAddress,
            userAgent: data.userAgent,
          });
          return { id: sessionId, ...data, createdAt: now, updatedAt: now };
        }

        if (model === "account") {
          const accountId = await convex.mutation(api.auth.betterAuth.createAccount, {
            userId: data.userId,
            accountId: data.accountId || data.id,
            providerId: data.providerId,
            accessToken: data.accessToken,
            refreshToken: data.refreshToken,
            expiresAt: data.expiresAt,
            scope: data.scope,
            password: data.password,
          });
          return { id: accountId, ...data, createdAt: now, updatedAt: now };
        }

        console.warn("[Convex Adapter] Unknown model:", model);
        return data;
      } catch (error) {
        console.error("[Convex Adapter] Create error:", error);
        throw error;
      }
    },

    async findOne({ model, where }: any) {
      console.log("[Convex Adapter] Finding:", model, where);

      try {
        if (model === "user" && where.email) {
          const user = await convex.query(api.auth.betterAuth.findUserByEmail, {
            email: where.email.value || where.email,
          });
          return user ? { id: user._id, ...user } : null;
        }

        if (model === "session" && where.token) {
          const result = await convex.query(api.auth.betterAuth.findSessionByToken, {
            token: where.token.value || where.token,
          });
          if (!result) return null;
          return {
            id: result.session._id,
            ...result.session,
            user: { id: result.user._id, ...result.user },
          };
        }

        return null;
      } catch (error) {
        console.error("[Convex Adapter] FindOne error:", error);
        return null;
      }
    },

    async findMany({ model }: any) {
      console.log("[Convex Adapter] Finding many:", model);
      return [];
    },

    async update({ model, where, data }: any) {
      console.log("[Convex Adapter] Updating:", model, where, data);

      try {
        if (model === "user" && where.id) {
          await convex.mutation(api.auth.betterAuth.updateUser, {
            userId: where.id.value || where.id,
            ...data,
          });
          return { id: where.id.value || where.id, ...data, updatedAt: Date.now() };
        }
        return data;
      } catch (error) {
        console.error("[Convex Adapter] Update error:", error);
        throw error;
      }
    },

    async delete({ model, where }: any) {
      console.log("[Convex Adapter] Deleting:", model, where);

      try {
        if (model === "session" && where.id) {
          await convex.mutation(api.auth.betterAuth.deleteSession, {
            sessionId: where.id.value || where.id,
          });
          return true;
        }
        return true;
      } catch (error) {
        console.error("[Convex Adapter] Delete error:", error);
        return false;
      }
    },
  };
}
