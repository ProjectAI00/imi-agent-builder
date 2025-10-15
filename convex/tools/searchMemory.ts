import { createTool } from "@convex-dev/agent";
import { z } from "zod";
import { internal, components } from "../_generated/api";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { generateObject } from "ai";

const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY!,
});

/**
 * Search user's memory for past conversations
 * Uses fast model to parse query and find relevant memories
 */
export const searchMemoryHandler = async (
  ctx: any,
  { query }: { query: string },
): Promise<any> => {
  const userId = ctx.userId;
  if (!userId) {
    return {
      success: false,
      error: "No user ID provided",
    };
  }

  console.log(`[Memory Search] Query: "${query}" for user ${userId}`);

  try {
    // Get limited recent memories to prevent context overflow
    const memories = await ctx.runQuery(
      internal.tools.searchMemoryHelpers.searchMemoriesLimited,
      {
        userId,
        limit: 10, // Only fetch top 10 most recent memories
      }
    );

    if (memories.length === 0) {
      return {
        success: true,
        found: false,
        message:
          "I don't have any stored memories yet. As we talk more, I'll remember important things.",
      };
    }

    // Compress memories to only essential data
    const compressedMemories = memories.map((m: any) => ({
      _id: m._id,
      facts: m.facts,
      entities: m.entities,
      timestamp: m.timestamp,
      threadId: m.threadId,
    }));

    // Use fast model to find matching memories
    let searchResult;
    try {
      const result = await generateObject({
        model: openrouter("openai/gpt-oss-20b"),
        schema: z.object({
          matchingMemoryIds: z.array(z.string()),
          relevantFacts: z.array(z.string()),
          confidence: z.enum(["high", "medium", "low"]),
        }),
        prompt: `The user is searching for: "${query}"

Here are their stored memories (most recent):
${JSON.stringify(compressedMemories, null, 2)}

Find which memories match the query. Return:
1. matchingMemoryIds: IDs of memories that match
2. relevantFacts: specific facts from those memories
3. confidence: how confident you are in the match

If no good match, return empty arrays and low confidence.`,
      });
      searchResult = result.object;
    } catch (modelError) {
      console.error("[Memory Search] Model error, using fallback:", modelError);
      // Fallback: return all memories without filtering
      return {
        success: true,
        found: true,
        confidence: "medium",
        facts: compressedMemories.flatMap((m: any) => m.facts || []),
        memories: compressedMemories,
        message: `Found ${memories.length} recent memories. (Note: AI filtering unavailable)`,
      };
    }

    if (searchResult.matchingMemoryIds.length === 0) {
      return {
        success: true,
        found: false,
        message: `I don't see "${query}" in our chat history. Can you remind me?`,
      };
    }

    // Get the full memories
    const matchedMemories = memories.filter((m: any) =>
      searchResult.matchingMemoryIds.includes(m._id)
    );

    // Load messages from the most relevant thread for full context
    const primaryThread = matchedMemories[0].threadId;
    const threadMessages = await ctx.runQuery(
      components.agent.messages.listMessagesByThreadId,
      {
        threadId: primaryThread,
        order: "asc" as const,
      }
    );

    return {
      success: true,
      found: true,
      confidence: searchResult.confidence,
      facts: searchResult.relevantFacts,
      threadId: primaryThread,
      messageCount: threadMessages.page.length,
      context: `Found from conversation on ${new Date(
        matchedMemories[0].timestamp
      ).toLocaleDateString()}`,
    };
  } catch (error) {
    console.error("[Memory Search] Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Search failed",
    };
  }
};

export const searchMemory: any = createTool({
  description: `Search through past conversations to recall previous discussions.

Use this when the user asks about something from a previous conversation:
- "Remember when we talked about X?"
- "What did I say about Y?"
- "Do you recall our discussion about Z?"

Returns relevant facts and the thread ID to load full context.`,

  args: z.object({
    query: z.string().describe("What the user wants to recall (e.g., 'Jasmine', 'startup idea', 'career advice')"),
  }),

  handler: async (ctx, args) => searchMemoryHandler(ctx, args),
});

