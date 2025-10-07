import { QueryCtx, MutationCtx } from "../_generated/server";
import { ToolRouterClient } from "./toolRouterClient";

type AnyCtx = QueryCtx | MutationCtx;

export async function getToolRouterClient(
  ctx: AnyCtx,
  userId: string
): Promise<ToolRouterClient | null> {
  const session = await ctx.db
    .query("toolRouterSessions")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .first();

  if (!session) {
    return null;
  }

  if (session.expiresAt && session.expiresAt < Date.now()) {
    return null;
  }

  const client = new ToolRouterClient(session.sessionUrl);
  await client.connect();

  return client;
}
