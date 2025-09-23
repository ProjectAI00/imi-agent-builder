"use client";

import { MCPTransport, type McpServerInfo } from "@tambo-ai/react/mcp";

/**
 * Ensure the default Twitter MCP server is present in localStorage so
 * the app auto-connects without user configuration.
 */
export function ensureTwitterMcpDefault() {
  if (typeof window === "undefined") return;

  const defaultUrl =
    process.env.NEXT_PUBLIC_TWITTER_MCP_URL || "http://localhost:3002";

  try {
    const raw = localStorage.getItem("mcp-servers");
    const existing: McpServerInfo[] = raw ? JSON.parse(raw) : [];

    // If already present, do nothing
    const has = existing.some((s) =>
      typeof s === "string" ? s === defaultUrl : s.url === defaultUrl,
    );
    if (has) return;

    const entry: McpServerInfo = {
      url: defaultUrl,
      transport: MCPTransport.HTTP,
      name: "twitter-mcp-server",
    } as McpServerInfo;

    const updated = [...existing, entry];
    localStorage.setItem("mcp-servers", JSON.stringify(updated));

    // Notify listeners
    window.dispatchEvent(
      new CustomEvent("mcp-servers-updated", { detail: updated }),
    );
  } catch (e) {
    console.error("Failed to ensure default Twitter MCP server", e);
  }
}

