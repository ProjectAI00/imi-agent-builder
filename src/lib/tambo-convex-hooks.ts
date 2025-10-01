/**
 * Tambo-compatible hooks powered by Convex
 *
 * These hooks provide the same API as @tambo-ai/react hooks,
 * but use Convex backend instead of Tambo's API.
 */

"use client";

import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useState, useCallback, useEffect, useMemo } from "react";

/**
 * useTamboThread - Compatible with Tambo's hook
 *
 * Provides thread state and message management
 */
export function useTamboThread(options: { contextKey?: string } = {}) {
  const { contextKey } = options;
  const [threadId, setThreadId] = useState<string | null>(null);
  const [userId] = useState("anonymous");

  // Get or create thread
  const getOrCreateThread = useMutation(api.chat.threads.getOrCreate);

  // Initialize thread
  useEffect(() => {
    if (!threadId) {
      getOrCreateThread({
        userId,
        contextKey,
      }).then((result) => {
        setThreadId(result.threadId);
      });
    }
  }, [threadId, contextKey, userId, getOrCreateThread]);

  // Query messages
  const messagesResult = useQuery(
    api.chat.messages.list,
    threadId ? { threadId } : "skip"
  );

  // Transform to Tambo format
  const messages = useMemo(() => {
    if (!messagesResult?.page) return [];

    return messagesResult.page.map((msg) => {
      const content = msg.message?.content;
      const text =
        typeof content === "string"
          ? content
          : Array.isArray(content)
          ? content.find((c) => c.type === "text")?.text || ""
          : msg.text || "";

      return {
        id: msg._id,
        role: msg.message?.role || "assistant",
        content: text,
        text,
        timestamp: msg._creationTime,
        status: msg.status,
      };
    });
  }, [messagesResult]);

  // Check status
  const isPending = messages.some((m) => m.status === "pending");
  const isIdle = !isPending;

  return {
    messages,
    threadId,
    isPending,
    isIdle,
    cancel: () => {
      // TODO: Implement cancel if needed
      console.log("Cancel not yet implemented");
    },
  };
}

/**
 * useTamboThreadInput - Compatible with Tambo's input hook
 *
 * Handles message input and submission
 */
export function useTamboThreadInput() {
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  const { threadId } = useTamboThread();
  const sendMessageAction = useAction(api.chat.sendMessage.send);

  const submit = useCallback(
    async (content?: string) => {
      const messageText = content || value;
      if (!messageText.trim() || !threadId) return;

      setIsPending(true);
      setError(null);

      try {
        await sendMessageAction({
          threadId,
          prompt: messageText,
          userId: "anonymous",
        });

        setValue("");
      } catch (err) {
        console.error("Error sending message:", err);
        setError(err instanceof Error ? err.message : "Failed to send message");
      } finally {
        setIsPending(false);
      }
    },
    [value, threadId, sendMessageAction]
  );

  return {
    value,
    setValue,
    submit,
    isPending,
    error,
  };
}

/**
 * useTamboThreadList - Compatible with Tambo's thread list hook
 */
export function useTamboThreadList(options: { contextKey?: string } = {}) {
  const [userId] = useState("anonymous");
  const threads = useQuery(api.chat.threads.list, { userId });

  return {
    threads: threads?.page || [],
    isLoading: !threads,
  };
}

/**
 * useTamboSuggestions - Compatible with Tambo's suggestions hook
 */
export function useTamboSuggestions(options: { maxSuggestions?: number } = {}) {
  // For now, return empty suggestions
  // Can be enhanced later
  return {
    suggestions: [],
    isLoading: false,
    refresh: () => {},
  };
}