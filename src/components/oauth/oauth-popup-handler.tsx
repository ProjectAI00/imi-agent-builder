"use client";

import { useEffect, useCallback, useRef } from "react";

interface OAuthPopupHandlerProps {
  messages: Array<{
    id: string;
    role: string;
    content: string;
    [key: string]: any;
  }>;
}

/**
 * OAuth Popup Handler
 *
 * Automatically detects when the AI returns an OAuth URL and opens it in a popup.
 * This keeps users in the app instead of navigating away.
 */
export function OAuthPopupHandler({ messages }: OAuthPopupHandlerProps) {
  // Track which messages we've already processed to avoid re-opening popups
  const processedMessageIds = useRef(new Set<string>());

  const handleOAuthCallback = useCallback((event: MessageEvent) => {
    // Listen for OAuth completion message from callback page
    if (event.data?.type === "oauth-complete") {
      console.log("[OAuth] Authentication completed successfully");
      // The popup will close itself
    }
  }, []);

  useEffect(() => {
    // Listen for OAuth completion messages
    window.addEventListener("message", handleOAuthCallback);
    return () => window.removeEventListener("message", handleOAuthCallback);
  }, [handleOAuthCallback]);

  useEffect(() => {
    // Check the most recent assistant message for OAuth URLs
    const lastMessage = messages
      .filter((m) => m.role === "assistant")
      .pop();

    if (!lastMessage?.content || !lastMessage?.id) return;

    // Skip if we've already processed this message
    if (processedMessageIds.current.has(lastMessage.id)) {
      return;
    }

    console.log("[OAuth Debug] Checking message:", lastMessage.id);

    // Look for markdown links with "Authenticate" or any Composio URL
    const markdownLinkRegex = /\[(?:Authenticate|Connect|Authorize) [^\]]+\]\((https:\/\/backend\.composio\.dev\/[^\)]+)\)/i;
    const match = lastMessage.content.match(markdownLinkRegex);

    // Also try to find raw Composio URLs as fallback
    const rawUrlMatch = !match ? lastMessage.content.match(/(https:\/\/backend\.composio\.dev\/api\/v3\/s\/[a-zA-Z0-9_-]+)/) : null;

    const authUrl = match?.[1] || rawUrlMatch?.[1];

    if (authUrl) {
      // Mark this message as processed BEFORE opening popup
      processedMessageIds.current.add(lastMessage.id);

      console.log("[OAuth] Opening authentication popup:", authUrl);

      // Open popup window
      const popup = window.open(
        authUrl,
        "oauth-popup",
        "width=600,height=700,popup=1,toolbar=0,menubar=0,location=0"
      );

      if (!popup) {
        console.error("[OAuth] Popup was blocked by browser");
        alert("Please allow popups for this site to authenticate apps");
        return;
      }

      // Poll to check if popup is closed
      const pollTimer = setInterval(() => {
        if (popup.closed) {
          clearInterval(pollTimer);
          console.log("[OAuth] Popup closed");
          // Optionally trigger a refresh or notification here
        }
      }, 500);

      // Clean up after 5 minutes
      setTimeout(() => {
        clearInterval(pollTimer);
        if (!popup.closed) {
          popup.close();
        }
      }, 5 * 60 * 1000);
    }
  }, [messages]);

  // This component doesn't render anything
  return null;
}
