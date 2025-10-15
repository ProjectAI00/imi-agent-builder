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

  // Better Auth: User table
  authUsers: defineTable({
    email: v.string(),
    emailVerified: v.boolean(),
    name: v.optional(v.string()),
    image: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_email", ["email"]),

  // Better Auth: Session table
  authSessions: defineTable({
    userId: v.union(v.id("authUsers"), v.string()),
    expiresAt: v.number(),
    token: v.string(),
    ipAddress: v.optional(v.string()),
    userAgent: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_token", ["token"])
    .index("by_userId", ["userId"]),

  // Better Auth: Account table (for OAuth)
  authAccounts: defineTable({
    userId: v.union(v.id("authUsers"), v.string()),
    accountId: v.string(),
    providerId: v.string(),
    accessToken: v.optional(v.string()),
    refreshToken: v.optional(v.string()),
    expiresAt: v.optional(v.number()),
    scope: v.optional(v.string()),
    password: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_userId", ["userId"]),

  // Better Auth: Verification table
  authVerifications: defineTable({
    identifier: v.string(),
    value: v.string(),
    expiresAt: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_identifier", ["identifier"]),

  // Custom thread metadata (extends Agent component's threads)
  threadMetadata: defineTable({
    threadId: v.string(), // Reference to agent.threads table
    userId: v.string(),

    // Thread details
    title: v.optional(v.string()),
    summary: v.optional(v.string()),
    contextKey: v.optional(v.string()), // For Tambo compatibility

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

  // User memory storage for structured recall
  userMemories: defineTable({
    userId: v.string(),
    threadId: v.string(),
    timestamp: v.number(),

    // Extracted entities (flexible JSON structure)
    entities: v.any(), // { people: [...], topics: [...], places: [...], etc }

    // Key facts from the conversation
    facts: v.array(v.string()),

    // Priority level for importance
    priority: v.string(), // "low", "medium", "high"

    // Soft delete support
    deleted: v.boolean(),
    deletedAt: v.optional(v.number()),

    // References to original messages for full context
    messageIds: v.array(v.string()),

    // Version history for undo
    previousVersion: v.optional(v.any()),
  })
    .index("by_userId", ["userId"])
    .index("by_threadId", ["threadId"])
    .index("by_userId_and_timestamp", ["userId", "timestamp"])
    .index("by_userId_and_deleted", ["userId", "deleted"]),

  // Tool Router sessions (Composio MCP integration)
  toolRouterSessions: defineTable({
    userId: v.string(),
    sessionId: v.string(),
    sessionUrl: v.string(),
    connectedToolkits: v.array(v.string()),
    createdAt: v.number(),
    lastActiveAt: v.number(),
    expiresAt: v.optional(v.number()),
    
    // Background worker configuration
    backgroundWorkers: v.optional(v.array(v.object({
      id: v.string(),
      type: v.string(),
      enabled: v.boolean(),
      schedule: v.string(),
      config: v.any(),
      lastRun: v.optional(v.number()),
      nextRun: v.optional(v.number()),
    }))),
  })
    .index("by_userId", ["userId"])
    .index("by_sessionId", ["sessionId"]),

  // Background task execution results
  backgroundTasks: defineTable({
    userId: v.string(),
    sessionId: v.string(),
    workerId: v.string(),
    taskType: v.string(),
    status: v.string(),
    startedAt: v.number(),
    completedAt: v.optional(v.number()),
    toolsCalled: v.array(v.string()),
    results: v.any(),
    error: v.optional(v.string()),
    userNotified: v.boolean(),
    notificationMessage: v.optional(v.string()),
  })
    .index("by_userId", ["userId"])
    .index("by_status", ["status"])
    .index("by_userId_and_status", ["userId", "status"]),

  // Plans for two-agent architecture
  plans: defineTable({
    userId: v.string(),
    threadId: v.string(),

    // Plan details
    goal: v.string(),
    steps: v.array(v.object({
      id: v.string(),
      description: v.string(),
      action: v.string(), // Tool action name
      args: v.any(), // Tool arguments
      status: v.string(), // "pending", "running", "completed", "failed"
      result: v.optional(v.any()),
      error: v.optional(v.string()),
      retryCount: v.number(),
      executionType: v.string(), // "parallel" or "sequential"
      dependsOn: v.optional(v.array(v.string())), // Step IDs this step depends on
    })),

    // Execution status
    status: v.string(), // "pending", "running", "completed", "failed", "cancelled"
    currentStepIndex: v.number(),
    progress: v.string(), // Human-readable progress message

    // Metadata
    createdAt: v.number(),
    startedAt: v.optional(v.number()),
    completedAt: v.optional(v.number()),

    // Results
    finalResult: v.optional(v.any()),
    error: v.optional(v.string()),
  })
    .index("by_userId", ["userId"])
    .index("by_threadId", ["threadId"])
    .index("by_status", ["status"])
    .index("by_userId_and_status", ["userId", "status"]),

  // Scratchpad state for planner/executor handoff
  executionScratchpads: defineTable({
    jobId: v.string(),
    userId: v.string(),
    threadId: v.string(),
    planId: v.optional(v.string()),

    status: v.string(), // pending, running, blocked, completed, failed
    lastEventAt: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),

    steps: v.array(v.object({
      stepId: v.string(),
      description: v.optional(v.string()),
      status: v.string(),
      startedAt: v.optional(v.number()),
      completedAt: v.optional(v.number()),
      retries: v.number(),
      result: v.optional(v.any()),
      error: v.optional(v.string()),
      rollbackStatus: v.optional(v.string()),
    })),

    artifacts: v.array(v.object({
      key: v.string(),
      value: v.any(),
      visibility: v.optional(v.string()), // internal, user
      createdAt: v.number(),
      linkedStepId: v.optional(v.string()),
    })),

    metadata: v.optional(v.any()),
  })
    .index("by_jobId", ["jobId"])
    .index("by_threadId", ["threadId"])
    .index("by_userId", ["userId"])
    .index("by_status", ["status"]),

  // Thread context cache - for contextAgent to provide info to imiAgent
  threadContext: defineTable({
    threadId: v.string(),
    userId: v.string(),

    // Context metadata
    contextType: v.string(), // "memory", "twitter", "app_data"
    summary: v.string(), // Summarized context for imiAgent

    // Reference tracking
    relevantTo: v.optional(v.string()), // Message ID that triggered this context

    // Lifecycle
    createdAt: v.number(),
    expiresAt: v.number(), // Auto-expire old context (5-10 minutes)

    // Optional: store raw data for debugging
    rawData: v.optional(v.any()),

    // Priority/relevance scoring
    relevanceScore: v.optional(v.number()),
  })
    .index("by_threadId", ["threadId"])
    .index("by_threadId_and_type", ["threadId", "contextType"])
    .index("by_expiresAt", ["expiresAt"])
    .index("by_userId", ["userId"]),
});