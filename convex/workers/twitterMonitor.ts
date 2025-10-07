import { internalMutation } from "../_generated/server";
import { internal } from "../_generated/api";
import { getToolRouterClient } from "../lib/getToolRouterClient";

export const monitorTwitter = internalMutation({
  handler: async (ctx) => {
    const sessions = await ctx.db.query("toolRouterSessions").collect();

    for (const session of sessions) {
      const twitterWorker = session.backgroundWorkers?.find(
        (w) => w.type === "twitter_monitor" && w.enabled
      );

      if (!twitterWorker) {
        continue;
      }

      const startTime = Date.now();

      try {
        const client = await getToolRouterClient(ctx, session.userId);
        if (!client) {
          continue;
        }

        const discovery = await client.searchTools(
          "Check my Twitter mentions and recent activity",
          { toolkits: ["twitter"] }
        );

        const results = await client.executeTools([
          {
            tool_slug: "TWITTER_GET_MENTIONS",
            arguments: {
              count: 10,
              since_id: twitterWorker.config?.lastProcessedId || null,
            },
          },
        ]);

        await ctx.db.insert("backgroundTasks", {
          userId: session.userId,
          sessionId: session.sessionId,
          workerId: twitterWorker.id,
          taskType: "twitter_monitor",
          status: "completed",
          startedAt: startTime,
          completedAt: Date.now(),
          toolsCalled: ["TWITTER_GET_MENTIONS"],
          results: results,
          userNotified: false,
        });

        await client.disconnect();
      } catch (error) {
        await ctx.db.insert("backgroundTasks", {
          userId: session.userId,
          sessionId: session.sessionId,
          workerId: twitterWorker?.id || "unknown",
          taskType: "twitter_monitor",
          status: "failed",
          startedAt: startTime,
          completedAt: Date.now(),
          toolsCalled: [],
          results: {},
          error: error instanceof Error ? error.message : "Unknown error",
          userNotified: false,
        });
      }
    }
  },
});
