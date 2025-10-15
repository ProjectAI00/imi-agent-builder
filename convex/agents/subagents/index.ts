/**
 * Subagent Registry (Layer 3)
 *
 * Central registry of all available subagents that the main conversational agent
 * can delegate tasks to. Each subagent is a specialist with focused tools and prompts.
 *
 * To add a new subagent:
 * 1. Create a new file in this folder (e.g., emailWriter.ts)
 * 2. Export a SubagentDefinition with name, description, tools, systemPrompt, model
 * 3. Import and add it to the SUBAGENTS object below
 */

import { toolExecutor } from "../prompts/toolExecutor";

/**
 * Available Subagents
 *
 * Key: The identifier used when calling the "task" tool from Layer 2
 * Value: SubagentDefinition with configuration
 */
export const SUBAGENTS = {
  // Active subagents
  tool_executor: toolExecutor,

  // Future subagents (uncomment when implemented):
  // email_writer: emailWriter,     // Specialized in drafting professional emails
  // doc_creator: docCreator,       // Creates documents, reports, presentations
  // data_analyzer: dataAnalyzer,   // Analyzes data and generates insights
  // research_assistant: researcher, // Deep research across multiple sources
};

/**
 * Type helper for subagent keys
 */
export type SubagentKey = keyof typeof SUBAGENTS;
