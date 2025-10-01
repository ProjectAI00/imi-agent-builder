/**
 * Convex Chat Hook - Adapter for Tambo UI
 *
 * This hook bridges the Convex backend with the existing Tambo UI components.
 * It provides the same interface as Tambo's useTamboThread hook.
 */

"use client";

import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useState, useCallback, useEffect } from "react";
import type { Id } from "../../convex/_generated/dataModel";

export interface ConvexChatOptions {
  userId?: string;
  contextKey?: string;
  threadId?: string | null;
  agentType?: "casual" | "roast";
}

export function useConvexChat(options: ConvexChatOptions = {}) {
  const { userId = "anonymous", contextKey, threadId: externalThreadId, agentType = "casual" } = options;

  // State
  const [internalThreadId, setInternalThreadId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [optimisticMessages, setOptimisticMessages] = useState<Array<{
    id: string;
    role: "user" | "assistant";
    content: string;
    timestamp: number;
    status?: string;
  }>>([]);

  // Prefer external threadId when it's a concrete id; if it's null/undefined, fall back to internal
  const threadId = externalThreadId ?? internalThreadId;

  // Actions and Mutations
  const sendMessageAction = useAction(api.chat.sendMessage.send);
  const createThreadAction = useAction(api.chat.threads.create);
  const getOrCreateThreadMutation = useMutation(api.chat.threads.getOrCreate);

  // Sync external threadId to internal
  useEffect(() => {
    if (externalThreadId !== undefined) {
      setInternalThreadId(externalThreadId);
    }
  }, [externalThreadId]);

  // Query messages (real-time subscription)
  const messagesResult = useQuery(
    api.chat.messages.list,
    threadId ? { threadId } : "skip"
  );

  // Send message handler
  const sendMessage = useCallback(
    async (content: string) => {
      setIsLoading(true);

      // Add optimistic user message immediately
      const optimisticId = `temp-${Date.now()}`;
      const userMessage = {
        id: optimisticId,
        role: "user" as const,
        content,
        timestamp: Date.now(),
      };

      setOptimisticMessages((prev) => [...prev, userMessage]);

      try {
        let activeThreadId = threadId;

        // Create thread if it doesn't exist (only when the external selection is intentionally "new" (null))
        if (!activeThreadId && externalThreadId === null) {
          const newThread = await createThreadAction({
            userId,
            agentType,
          });
          activeThreadId = newThread.threadId;
          // Update internal thread ID which will trigger messages query
          setInternalThreadId(activeThreadId);

          // Inject a hidden system note with the user's default Twitter handle
          // The Convex agent will see this message in context, but the UI hides it
          try {
            await sendMessageAction({
              threadId: activeThreadId,
              prompt: `[SYSTEM:TWITTER_HANDLE ${userId}]`,
              userId,
              agentType,
              // Don't trigger an AI response for system notes
              skipResponse: true,
            } as any);
          } catch (e) {
            console.warn("Failed to inject system handle note", e);
          }
        }

        if (!activeThreadId) {
          throw new Error("No thread ID available");
        }

        await sendMessageAction({
          threadId: activeThreadId,
          prompt: content,
          userId,
          agentType,
        });

        // Don't clear optimistic messages immediately
        // They'll be replaced when the real messages come from the query
      } catch (error) {
        console.error("Error sending message:", error);
        // Remove optimistic message on error
        setOptimisticMessages((prev) => prev.filter(msg => msg.id !== optimisticId));
        throw error;
      } finally {
        setIsLoading(false);
      }
    },
    [threadId, externalThreadId, userId, agentType, sendMessageAction, createThreadAction]
  );

  // Transform Convex messages to Tambo format
  const dbMessages = messagesResult?.page
    ?.filter((msg) => msg.role === "user" || msg.role === "assistant") // Only show user and assistant messages
    ?.filter((msg) => !(msg.text || "").startsWith("[SYSTEM:")) // Hide system prompts
    ?.sort((a, b) => (a._creationTime ?? 0) - (b._creationTime ?? 0))
    ?.map((msg) => {
      return {
        id: msg.id,
        role: msg.role as "user" | "assistant",
        content: msg.text || "",
        timestamp: msg._creationTime,
        status: msg.status,
      };
    }) || [];

  // Clear optimistic messages once we have real messages with matching content
  useEffect(() => {
    if (dbMessages.length > 0 && optimisticMessages.length > 0) {
      // Check if any optimistic message now exists in db
      const dbContents = new Set(dbMessages.map(m => m.content));
      const shouldClear = optimisticMessages.some(om => dbContents.has(om.content));

      if (shouldClear) {
        setOptimisticMessages([]);
      }
    }
  }, [dbMessages, optimisticMessages]);

  // Merge optimistic messages with db messages (filter out duplicates)
  const optimisticToShow = optimisticMessages.filter(om =>
    !dbMessages.some(dm => dm.content === om.content)
  );
  const messages = [...dbMessages, ...optimisticToShow];

  // Deduplicate accidental double posts (same role + same content)
  const dedupedMessages = (() => {
    const seen = new Set<string>();
    const out: typeof messages = [];
    for (const m of messages) {
      const key = `${m.role}|${m.content.trim()}`;
      if (seen.has(key)) {
        console.log(`[DEDUP] Skipping duplicate message: ${m.content.substring(0, 50)}...`);
        continue;
      }
      seen.add(key);
      out.push(m);
    }
    return out;
  })();

  return {
    // Thread info
    threadId,
    isLoading: isLoading || (!messagesResult && threadId !== null),

    // Messages
    messages: dedupedMessages,

    // Actions
    sendMessage,

    // Pagination (for future use)
    hasMore: !messagesResult?.isDone,
    loadMore: () => {
      // TODO: Implement pagination
    },
  };
}

/**
 * Hook for managing multiple threads
 */
export function useConvexThreads(userId: string = "anonymous") {
  const threads = useQuery(api.chat.threads.list, { userId });
  const deleteThreadMutation = useMutation(api.chat.threads.deleteThread);

  const deleteThread = useCallback(
    async (threadId: string) => {
      await deleteThreadMutation({ threadId });
    },
    [deleteThreadMutation]
  );

  return {
    threads: (threads || []).map(t => ({
      id: t.threadId,
      title: t.title,
      contextKey: t.contextKey,
      lastMessageTime: t.lastMessageAt,
      messageCount: t.messageCount,
    })),
    isLoading: !threads,
    deleteThread,
  };
}

/**
 * Hook for user management
 */
export function useConvexUser(userId: string, options: {
  phoneNumber?: string;
  email?: string;
  preferredAgent?: string;
} = {}) {
  const createOrGetUserMutation = useMutation(api.users.getOrCreate.getOrCreate);

  useEffect(() => {
    createOrGetUserMutation({
      userId,
      ...options,
    });
  }, [userId, createOrGetUserMutation, options]);
}