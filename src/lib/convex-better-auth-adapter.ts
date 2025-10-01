import { ConvexHttpClient } from "convex/browser";
import { api } from "../../convex/_generated/api";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export function createConvexAdapter() {
  return {
    id: "convex",

    async create({ model, data }: any) {
      const now = Date.now();

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
          accountId: data.accountId,
          providerId: data.providerId,
          accessToken: data.accessToken,
          refreshToken: data.refreshToken,
          expiresAt: data.expiresAt,
          scope: data.scope,
          password: data.password,
        });
        return { id: accountId, ...data, createdAt: now, updatedAt: now };
      }

      return data;
    },

    async findOne({ model, where }: any) {
      if (model === "user" && where.email) {
        const user = await convex.query(api.auth.betterAuth.findUserByEmail, {
          email: where.email.value,
        });
        return user ? { id: user._id, ...user } : null;
      }

      if (model === "session" && where.token) {
        const result = await convex.query(api.auth.betterAuth.findSessionByToken, {
          token: where.token.value,
        });
        if (!result) return null;
        return {
          id: result.session._id,
          ...result.session,
          user: { id: result.user._id, ...result.user },
        };
      }

      return null;
    },

    async findMany({ model }: any) {
      return [];
    },

    async update({ model, where, data }: any) {
      if (model === "user" && where.id) {
        await convex.mutation(api.auth.betterAuth.updateUser, {
          userId: where.id.value,
          ...data,
        });
        return { id: where.id.value, ...data, updatedAt: Date.now() };
      }
      return data;
    },

    async delete({ model, where }: any) {
      if (model === "session" && where.id) {
        await convex.mutation(api.auth.betterAuth.deleteSession, {
          sessionId: where.id.value,
        });
        return true;
      }
      return true;
    },
  };
}
