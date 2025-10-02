import { type Config } from "@convex-dev/agent";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";

/**
 * Shared agent configuration using your existing models
 * This matches the setup from src/lib/models.ts
 */

const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY!,
});

// Your models - keeping the exact same setup
export const models = {
  // Default: GLM-4.5
  default: openrouter("z-ai/glm-4.5"),

  // For casual conversations (more creative)
  casual: openrouter("z-ai/glm-4.5"),

  // For professional/precise responses
  professional: openrouter("z-ai/glm-4.5"),

  // Fallback options
  fast: openrouter("openai/gpt-5-nano"),
  coding: openrouter("qwen/qwen3-coder"),
  grok: openrouter("x-ai/grok-code-fast-1"),
};

// Model-specific temperatures (from your config)
export const temperatures = {
  default: 0.3,  // glm-4.5
  casual: 0.7,   // glm-4.5 - balanced for roasting
  professional: 0.3, // glm-4.5
  fast: 0.7,     // gpt-5-nano
  coding: 0.3,   // qwen-coder
  grok: 0.3,     // grok-code-fast
};

/**
 * Shared configuration for all agents
 */
export const defaultConfig: Partial<Config> = {
  // Usage tracking disabled for now (type compatibility issues)
  // Can be enabled once we fix the context typing

  // Call settings
  callSettings: {
    maxRetries: 3,
  },

  // Context options (balanced for performance and relevance)
  contextOptions: {
    recentMessages: 50,
    excludeToolMessages: true,
    searchOptions: {
      limit: 10,
      textSearch: false,
      vectorSearch: false,
      messageRange: { before: 2, after: 1 },
    },
    searchOtherThreads: false, // Enable when we have embeddings
  },
};