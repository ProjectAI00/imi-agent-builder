import { internalAction, internalMutation } from "../_generated/server";
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
      prompt: `Analyze this conversation and extract important information to remember.

Conversation:
${conversationText}

Extract:
1. Entities: people, topics, places, projects mentioned
2. Facts: key statements, decisions, or information worth remembering
3. Priority: how important is this information? (low/medium/high)
4. shouldStore: should we save this? (false if just casual chat with no substance)

Focus on:
- People mentioned with context about who they are
- Important decisions or plans
- Information the user explicitly wants remembered
- Topics discussed in depth

Skip:
- Casual greetings ("hey", "lol", "ok")
- Generic small talk
- Tool calls or errors`,
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
