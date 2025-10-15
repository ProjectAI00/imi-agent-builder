export const BLOCKED_MODELS = new Set([
  "x-ai/grok-code-fast-1",
  "x-ai/grok-4-fast",
  "x-ai/grok-4",
]);

// Default model for Layer 2/3 agents
export const MODEL_DEFAULT_FALLBACK = "z-ai/glm-4.5";
export const MODEL_FAST = "openai/gpt-5-nano";
export const MODEL_CODING = "qwen/qwen3-coder";

export const resolveModel = (candidate?: string | null): string => {
  if (!candidate || BLOCKED_MODELS.has(candidate)) {
    return MODEL_DEFAULT_FALLBACK;
  }
  return candidate;
};

export const resolveDefaultModel = (override?: string | null): string => {
  return resolveModel(
    override ??
      process.env.CLAUDE_AGENT_LOOP_MODEL ??
      process.env.OR_MODEL ??
      process.env.MODEL_DEFAULT ??
      MODEL_DEFAULT_FALLBACK,
  );
};
