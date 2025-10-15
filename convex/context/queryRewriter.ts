/**
 * Query Rewriter - Generates search variations using Gemini
 * 
 * Takes complex queries and generates multiple search variations to:
 * - Expand abbreviations and technical terms
 * - Consider conversation context
 * - Avoid repeating previously fetched information
 * - Handle follow-up intent
 */

import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { generateObject } from "ai";
import { z } from "zod";

const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY!,
});

export interface QueryRewrites {
  original: string;
  variations: string[];
  strategy: 'expansion' | 'conversation_context' | 'multi_concept' | 'follow_up';
  reasoning: string;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

const QueryRewriteSchema = z.object({
  variations: z.array(z.string()).min(2).max(5).describe("2-5 search query variations that capture different aspects or phrasings"),
  strategy: z.enum(['expansion', 'conversation_context', 'multi_concept', 'follow_up']).describe("Strategy used for rewriting"),
  reasoning: z.string().describe("Brief explanation of rewriting approach"),
});

/**
 * Generate search query variations using Gemini
 */
export async function rewriteQuery(
  userMessage: string,
  conversationHistory: Message[] = [],
  previousContext: string[] = []
): Promise<QueryRewrites> {
  
  // Build conversation context
  const historyText = conversationHistory.length > 0
    ? conversationHistory
        .slice(-5) // Last 5 messages
        .map(m => `${m.role}: ${m.content}`)
        .join('\n')
    : 'No prior conversation';
  
  const previousFactsText = previousContext.length > 0
    ? previousContext.join('\n- ')
    : 'No previous facts fetched';
  
  const prompt = `You're an ai context engine that is always silently thinking and reasoning about user's intention, ideas, questions and needs.
  you can access previous memories, previous conversations, and data from previous AI queries.

USER'S CURRENT QUESTION:
"${userMessage}"

RECENT CONVERSATION CONTEXT:
${historyText}

PREVIOUSLY RETRIEVED FACTS (DO NOT repeat these):
- ${previousFactsText}

TASK:
Generate 3-4 search query variations that will find RELEVANT but DIFFERENT information than what was already retrieved.

GUIDELINES:
1. **Expand abbreviations and technical terms**
   - "ML" → "machine learning"
   - "startup" → "startup company business"

2. **Consider conversation context**
   - If discussing a topic, search related aspects
   - If follow-up ("tell me more"), search deeper/related info

3. **Avoid repetition**
   - Don't search for facts already retrieved
   - Find NEW angles and related topics

4. **Handle follow-up intent**
   - "what else" → search different aspects of same topic
   - "tell me more" → search deeper details or related concepts

5. **Multi-concept queries**
   - Split into separate focused searches
   - "my startup and funding" → ["startup details", "funding plans"]

EXAMPLES:

Query: "What else do you know about my startup?"
Context: Already fetched "User is building an AI agent platform"
Variations:
- "startup business model revenue"
- "startup team members roles"
- "startup goals future plans"

Query: "tell me more"
Context: Last discussed "machine learning models"
Variations:
- "machine learning training techniques"
- "neural network architectures"
- "deep learning applications"

Query: "my favorite color and hobbies"
Variations:
- "favorite color preference"
- "hobbies interests activities"
- "personal preferences likes"

Generate variations that will discover NEW relevant information.`;

  try {
    const result = await generateObject({
      model: openrouter("google/gemini-2.5-flash-lite-preview-09-2025"),
      schema: QueryRewriteSchema,
      prompt,
      temperature: 0.7, // Some creativity for variations
    });

    return {
      original: userMessage,
      variations: result.object.variations,
      strategy: result.object.strategy,
      reasoning: result.object.reasoning,
    };
    
  } catch (error) {
    console.error('[QueryRewriter] Error generating rewrites:', error);
    
    // Fallback: Simple expansion
    return {
      original: userMessage,
      variations: [
        userMessage, // Keep original
        userMessage.replace(/\b(my|me|i)\b/gi, 'user'), // Perspective shift
      ],
      strategy: 'expansion',
      reasoning: 'Fallback due to API error - using simple variations',
    };
  }
}

/**
 * Quick heuristic-based rewriting (no AI) for ultra-fast fallback
 */
export function quickRewrite(userMessage: string): string[] {
  const variations: string[] = [userMessage];
  
  // Expand common abbreviations
  let expanded = userMessage
    .replace(/\bML\b/gi, 'machine learning')
    .replace(/\bAI\b/gi, 'artificial intelligence')
    .replace(/\bAPI\b/gi, 'application programming interface')
    .replace(/\bUI\b/gi, 'user interface')
    .replace(/\bUX\b/gi, 'user experience');
  
  if (expanded !== userMessage) {
    variations.push(expanded);
  }
  
  // Add keyword extraction version (remove filler words)
  const keywords = userMessage
    .toLowerCase()
    .replace(/\b(what|when|where|why|how|is|are|the|a|an|do|does|can|could|would|should|tell me|what do you know)\b/gi, '')
    .trim();
  
  if (keywords.length > 0 && keywords !== userMessage.toLowerCase()) {
    variations.push(keywords);
  }
  
  return [...new Set(variations)]; // Dedupe
}
