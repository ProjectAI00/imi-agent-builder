import { openai } from "@ai-sdk/openai";
import { groq } from "@ai-sdk/groq";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { LanguageModel } from "ai";

const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY!,
});

export const allModels = {
  openai: {
    // Note: GPT‑5 access is routed via OpenRouter, not the native OpenAI provider
  },
  groq: {
    "moonshotai/kimi-k2-instruct": groq("moonshotai/kimi-k2-instruct"),
  },
  openrouter: {
    // GPT‑5 via OpenRouter
    "openai/gpt-5-mini": openrouter("openai/gpt-5-mini"),
    "openai/gpt-5-nano": openrouter("openai/gpt-5-nano"),
    "z-ai/glm-4.5": openrouter("z-ai/glm-4.5"),
    "x-ai/grok-code-fast-1": openrouter("x-ai/grok-code-fast-1"),
    "qwen/qwen3-coder": openrouter("qwen/qwen3-coder"),
    "openai/gpt-oss-120b": openrouter("openai/gpt-oss-120b"),
    // Friendly alias for default model
    "IMI Fast": openrouter("openai/gpt-oss-120b"),
  },
} as const;

// Model-specific temperature settings
export const modelTemperatures = {
  "openai/gpt-5-mini": 0.7,
  "openai/gpt-5-nano": 0.7,
  "moonshotai/kimi-k2-instruct": 0.6, // Balanced temperature for focused yet creative responses
  "z-ai/glm-4.5": 0.7,
  "x-ai/grok-code-fast-1": 0.3,
  "qwen/qwen3-coder": 0.3, // Lower temperature for coding tasks
  "openai/gpt-oss-120b": 0.7,
  "IMI Fast": 0.7,
} as const;

export const isToolCallUnsupportedModel = (_model: LanguageModel) => {
  // No unsupported models in our current selection
  return false;
};

export const DEFAULT_MODEL = "x-ai/grok-code-fast-1";

// DEFAULT_MODEL lives in openrouter provider now
const fallbackModel = (allModels.openrouter as any)[
  DEFAULT_MODEL
] as LanguageModel;

export const customModelProvider = {
  // Flatten models into a single group and hide provider names
  modelsInfo: [
    {
      provider: "models",
      models: (
        Object.entries(allModels)
          .flatMap(([, models]) =>
            Object.keys(models).map((name) => ({
              name: String(name),
              isToolCallUnsupported: isToolCallUnsupportedModel(
                (models as any)[name] as LanguageModel,
              ),
            })),
          ) as { name: string; isToolCallUnsupported: boolean }[]
      ).sort((a, b) =>
        a.name === "IMI Fast"
          ? -1
          : b.name === "IMI Fast"
            ? 1
            : a.name.localeCompare(b.name),
      ),
    },
  ],
  getModel: (model?: string): LanguageModel => {
    if (!model) return fallbackModel;

    for (const provider of Object.values(allModels)) {
      if (model in provider) {
        return (provider as any)[model] as LanguageModel;
      }
    }

    return fallbackModel;
  },
};

// Helper function to get model temperature
export const getModelTemperature = (modelName: string): number => {
  return (modelTemperatures as any)[modelName] || 0.7;
};

// Available models for easy reference
export const availableModels = {
  // Fast coding models
  GROK_CODE_FAST: "x-ai/grok-code-fast-1",
  QWEN_CODER: "qwen/qwen3-coder",
  
  // General purpose models
  IMI_FAST: "IMI Fast",
  GPT_OSS_120B: "openai/gpt-oss-120b",
  
  // Advanced models
  GPT_5_MINI: "openai/gpt-5-mini",
  GPT_5_NANO: "openai/gpt-5-nano",
  
  // Specialized models
  GLM_4_5: "z-ai/glm-4.5",
  KIMI: "moonshotai/kimi-k2-instruct",
} as const;