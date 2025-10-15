import { v } from "convex/values";
import { internalMutation, query } from "../_generated/server";

const SCRATCHPAD_TABLE = "executionScratchpads" as const;

export const getByJobId = query({
  args: {
    jobId: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query(SCRATCHPAD_TABLE)
      .withIndex("by_jobId", (q) => q.eq("jobId", args.jobId))
      .first();
  },
});

export const getLatestByThread = query({
  args: {
    threadId: v.string(),
  },
  handler: async (ctx, args) => {
    const scratchpads = await ctx.db
      .query(SCRATCHPAD_TABLE)
      .withIndex("by_threadId", (q) => q.eq("threadId", args.threadId))
      .collect();

    if (scratchpads.length === 0) return null;

    scratchpads.sort((a, b) => (b.lastEventAt || 0) - (a.lastEventAt || 0));
    return scratchpads[0];
  },
});

export const upsertScratchpad = internalMutation({
  args: {
    jobId: v.string(),
    userId: v.string(),
    threadId: v.string(),
    planId: v.optional(v.string()),
    status: v.string(),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const existing = await ctx.db
      .query(SCRATCHPAD_TABLE)
      .withIndex("by_jobId", (q) => q.eq("jobId", args.jobId))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        status: args.status,
        updatedAt: now,
        lastEventAt: now,
        metadata: args.metadata ?? existing.metadata,
      });
      return existing._id;
    }

    return await ctx.db.insert(SCRATCHPAD_TABLE, {
      jobId: args.jobId,
      userId: args.userId,
      threadId: args.threadId,
      planId: args.planId,
      status: args.status,
      lastEventAt: now,
      createdAt: now,
      updatedAt: now,
      steps: [],
      artifacts: [],
      metadata: args.metadata,
    });
  },
});

export const recordStepProgress = internalMutation({
  args: {
    jobId: v.string(),
    step: v.object({
      stepId: v.string(),
      description: v.optional(v.string()),
      status: v.string(),
      startedAt: v.optional(v.number()),
      completedAt: v.optional(v.number()),
      retries: v.optional(v.number()),
      result: v.optional(v.any()),
      error: v.optional(v.string()),
      rollbackStatus: v.optional(v.string()),
    }),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query(SCRATCHPAD_TABLE)
      .withIndex("by_jobId", (q) => q.eq("jobId", args.jobId))
      .first();

    if (!existing) {
      throw new Error(`Scratchpad not found for job ${args.jobId}`);
    }

    const now = Date.now();
    const updatedSteps = (() => {
      const steps = existing.steps ?? [];
      const idx = steps.findIndex((step) => step.stepId === args.step.stepId);
      const base = {
        stepId: args.step.stepId,
        description: args.step.description,
        status: args.step.status,
        startedAt: args.step.startedAt ?? steps[idx]?.startedAt ?? now,
        completedAt: args.step.completedAt ?? steps[idx]?.completedAt,
        retries: args.step.retries ?? steps[idx]?.retries ?? 0,
        result: args.step.result ?? steps[idx]?.result,
        error: args.step.error,
        rollbackStatus: args.step.rollbackStatus ?? steps[idx]?.rollbackStatus,
      };

      if (idx === -1) {
        return [...steps, base];
      }

      const next = [...steps];
      next[idx] = { ...steps[idx], ...base };
      return next;
    })();

    await ctx.db.patch(existing._id, {
      steps: updatedSteps,
      updatedAt: now,
      lastEventAt: now,
    });
  },
});

export const appendArtifact = internalMutation({
  args: {
    jobId: v.string(),
    artifact: v.object({
      key: v.string(),
      value: v.any(),
      visibility: v.optional(v.string()),
      linkedStepId: v.optional(v.string()),
    }),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query(SCRATCHPAD_TABLE)
      .withIndex("by_jobId", (q) => q.eq("jobId", args.jobId))
      .first();

    if (!existing) {
      throw new Error(`Scratchpad not found for job ${args.jobId}`);
    }

    const now = Date.now();
    const artifacts = existing.artifacts ?? [];
    const filtered = artifacts.filter((item) => item.key !== args.artifact.key);

    filtered.push({
      key: args.artifact.key,
      value: args.artifact.value,
      visibility: args.artifact.visibility,
      createdAt: now,
      linkedStepId: args.artifact.linkedStepId,
    });

    await ctx.db.patch(existing._id, {
      artifacts: filtered,
      updatedAt: now,
      lastEventAt: now,
    });
  },
});
