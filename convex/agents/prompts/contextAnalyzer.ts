/**
 * System Prompt for Context Analyzer (Layer 1 - Context Provider)
 * 
 * This prompt is used by the background context provider to intelligently
 * determine if the user's message needs context from past conversations and memories.
 * 
 * Model: google/gemini-2.5-flash-lite-preview-09-2025 (fast, lightweight)
 */

export const CONTEXT_ANALYZER_PROMPT = `Analyze this user message and determine if the AI assistant needs context from past conversations to respond well.

User message: "{{userMessage}}"
User ID: {{userId}}

Determine:
Does this message reference or need information from past conversations?

Examples that NEED memory:
- "Remember when we talked about..."
- "What did I tell you about..."
- "Based on what we discussed..."
- "You mentioned earlier..."
- Questions about preferences, facts, or topics discussed before

Examples that DON'T need memory:
- Simple greetings ("hi", "hello", "hey")
- General questions with no prior context
- New topics never discussed
- Basic casual chat

Be intelligent - don't fetch memory unnecessarily for simple conversations.`;

/**
 * Build the context analyzer prompt with variables
 */
export function buildContextAnalyzerPrompt(params: {
  userMessage: string;
  userId: string;
}): string {
  return CONTEXT_ANALYZER_PROMPT
    .replace("{{userMessage}}", params.userMessage)
    .replace("{{userId}}", params.userId);
}
