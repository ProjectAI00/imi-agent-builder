import { internalAction, internalMutation, internalQuery } from "../_generated/server";
import { internal, components } from "../_generated/api";
import { v } from "convex/values";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { generateObject } from "ai";
import { z } from "zod";

const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY!,
});

/**
 * Extract memories from a thread after it goes idle
 * Run this as a scheduled job when thread hasn't had messages for 5 min
 */
export const extractFromThread = internalAction({
  args: {
    threadId: v.string(),
    userId: v.string(),
  },
  handler: async (ctx, { threadId, userId }) => {
    console.log(`[Memory Extraction] Starting for thread ${threadId}`);

    // Check if we already extracted memories from this thread recently (within last 5 minutes)
    const recentMemory = await ctx.runQuery(internal.memory.extractMemories.getRecentMemoryForThread, {
      threadId,
      withinMinutes: 5,
    });

    if (recentMemory) {
      console.log(`[Memory Extraction] Skipping - already extracted ${Math.round((Date.now() - recentMemory.timestamp) / 1000)}s ago`);
      return;
    }

    // Get all messages from thread
    const messagesResult = await ctx.runQuery(components.agent.messages.listMessagesByThreadId, {
      threadId,
      order: "asc" as const,
    });

    const messages = messagesResult.page;

    if (messages.length === 0) {
      console.log(`[Memory Extraction] No messages in thread ${threadId}`);
      return;
    }

    // Build conversation text
    const conversationText = messages
      .filter((m): m is typeof m & { text: string } => !!m.text)
      .map(m => `${m.agentName || 'user'}: ${m.text}`)
      .join("\n\n");

    // Use AI to extract structured memories
    const { object: extraction } = await generateObject({
      model: openrouter("z-ai/glm-4.5"),
      schema: z.object({
        entities: z.object({
          people: z.array(z.object({
            name: z.string(),
            context: z.string(),
            relationshipType: z.string().optional(),
          })).optional(),
          topics: z.array(z.string()).optional(),
          places: z.array(z.string()).optional(),
          projects: z.array(z.string()).optional(),
        }),
        facts: z.array(z.string()),
        priority: z.enum(["low", "medium", "high"]),
        shouldStore: z.boolean(),
      }),
      prompt: `Analyze this conversation and extract ONLY important long-term information worth remembering.

Conversation:
${conversationText}

Extract:
1. Entities: people, topics, places, projects mentioned
2. Facts: key statements, decisions, or information worth remembering
3. Priority: how important is this information? (low/medium/high)
4. shouldStore: should we save this? (false if no meaningful long-term information)

IMPORTANT - ONLY store memories that contain:
- New information ABOUT the user (their preferences, goals, projects, background)
- Important decisions or plans the user made
- Facts or insights the user shared about themselves or their work
- People, projects, or topics the user wants to track
- Outcomes or learnings from completed tasks

DO NOT store:
- User requests or commands (e.g., "user asked for X", "user wants Y")
- Task instructions without meaningful context
- Generic conversation flow
- Tool execution requests
- Casual chat or acknowledgments
- Temporary/transient information

Example of GOOD memory: "User is building an AI coworker called Imi with 500+ app integrations, focusing on VC/Founder operations vertical"
Example of BAD memory: "User requested a summary of their Google Docs", "User asked for help with X"`,
    });

    // Only store if AI thinks it's worth it
    if (!extraction.shouldStore) {
      console.log(`[Memory Extraction] Thread ${threadId} has no important memories to store`);
      return;
    }

    // Get message IDs for reference
    const messageIds = messages.map(m => m._id);

    // Store in database
    await ctx.runMutation(internal.memory.extractMemories.storeMemory, {
      userId,
      threadId,
      entities: extraction.entities,
      facts: extraction.facts,
      priority: extraction.priority,
      messageIds,
    });

    console.log(`[Memory Extraction] Stored ${extraction.facts.length} facts from thread ${threadId}`);
  },
});

/**
 * Check if we have recent memories from this thread
 */
export const getRecentMemoryForThread = internalQuery({
  args: {
    threadId: v.string(),
    withinMinutes: v.number(),
  },
  handler: async (ctx, { threadId, withinMinutes }) => {
    const cutoffTime = Date.now() - (withinMinutes * 60 * 1000);

    const recent = await ctx.db
      .query("userMemories")
      .withIndex("by_threadId", (q) => q.eq("threadId", threadId))
      .filter((q) => q.gte(q.field("timestamp"), cutoffTime))
      .first();

    return recent;
  },
});

/**
 * Store extracted memory
 */
export const storeMemory = internalMutation({
  args: {
    userId: v.string(),
    threadId: v.string(),
    entities: v.any(),
    facts: v.array(v.string()),
    priority: v.string(),
    messageIds: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("userMemories", {
      userId: args.userId,
      threadId: args.threadId,
      timestamp: Date.now(),
      entities: args.entities,
      facts: args.facts,
      priority: args.priority,
      deleted: false,
      messageIds: args.messageIds,
    });
  },
});
