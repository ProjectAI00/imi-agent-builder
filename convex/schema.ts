import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

/**
 * Database schema for Convex + Tambo AI integration
 *
 * This schema extends the Agent component's built-in tables
 * with custom tables for our application needs.
 */
export default defineSchema({
  // User profiles and preferences
  users: defineTable({
    // User identification (Twitter username)
    username: v.string(), // Twitter username (unique)
    userId: v.string(), // Same as username for compatibility
    passwordHash: v.string(), // Hashed password

    // Optional fields
    phoneNumber: v.optional(v.string()), // For iMessage integration
    email: v.optional(v.string()),

    // User preferences
    preferredAgent: v.optional(v.string()), // "casual" or "professional"
    preferences: v.optional(v.object({
      language: v.optional(v.string()),
      notifications: v.optional(v.boolean()),
    })),

    // Metadata
    createdAt: v.number(),
    lastActive: v.number(),
  })
    .index("by_username", ["username"])
    .index("by_userId", ["userId"])
    .index("by_phoneNumber", ["phoneNumber"])
    .index("by_email", ["email"]),

  // Sessions for auth
  sessions: defineTable({
    userId: v.string(),
    token: v.string(),
    expiresAt: v.number(),
  })
    .index("by_token", ["token"])
    .index("by_userId", ["userId"]),

  // Custom thread metadata (extends Agent component's threads)
  threadMetadata: defineTable({
    threadId: v.string(), // Reference to agent.threads table
    userId: v.string(),

    // Thread details
    title: v.optional(v.string()),
    summary: v.optional(v.string()),
    contextKey: v.optional(v.string()), // For Tambo compatibility

    // Agent configuration
    agentType: v.string(), // "casual" or "professional"

    // Metadata
    messageCount: v.number(),
    lastMessageAt: v.number(),
    createdAt: v.number(),
  })
    .index("by_threadId", ["threadId"])
    .index("by_userId", ["userId"])
    .index("by_userId_and_lastMessage", ["userId", "lastMessageAt"]),

  // Analytics and usage tracking
  usage: defineTable({
    userId: v.string(),
    agentName: v.string(),
    model: v.string(),
    provider: v.string(),

    // Token usage
    promptTokens: v.number(),
    completionTokens: v.number(),
    totalTokens: v.number(),

    // Cost tracking
    estimatedCost: v.number(),

    // Metadata
    timestamp: v.number(),
    threadId: v.optional(v.string()),
  })
    .index("by_userId", ["userId"])
    .index("by_timestamp", ["timestamp"])
    .index("by_userId_and_timestamp", ["userId", "timestamp"]),

  // Tool execution logs
  toolLogs: defineTable({
    toolName: v.string(),
    userId: v.string(),
    threadId: v.string(),

    // Execution details
    args: v.string(), // JSON string
    success: v.boolean(),
    error: v.optional(v.string()),

    // Performance
    executionTime: v.number(),

    // Metadata
    timestamp: v.number(),
  })
    .index("by_toolName", ["toolName"])
    .index("by_userId", ["userId"])
    .index("by_threadId", ["threadId"]),
});