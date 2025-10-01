/**
 * Convex-Tambo Integration
 *
 * This file re-exports Convex backend functionality with Tambo-compatible names.
 * Makes it easy to swap: just change the import path.
 *
 * Usage:
 * // Before:
 * import { TamboProvider, useTamboThread } from '@tambo-ai/react'
 *
 * // After:
 * import { TamboProvider, useTamboThread } from '@/lib/convex-tambo'
 */

// Provider
export { ConvexTamboProvider as TamboProvider } from "./convex-tambo-provider";

// Hooks
export {
  useTamboThread,
  useTamboThreadInput,
  useTamboThreadList,
  useTamboSuggestions,
} from "./tambo-convex-hooks";

// MCP Provider passthrough (we don't change this)
export { TamboMcpProvider, MCPTransport } from "@tambo-ai/react/mcp";