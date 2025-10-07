"use client";

import { UsernameAuthWrapper } from "@/components/auth/username-auth-wrapper";
import { ConvexChatLayout } from "@/components/convex-chat/convex-chat-layout";
import { OAuthPopupHandler } from "@/components/oauth/oauth-popup-handler";
import { useConvexChat, useConvexThreads } from "@/hooks/use-convex-chat";
import { authClient } from "@/lib/auth-client";
import { useState, useEffect, useRef } from "react";

export default function ChatPage() {
  const { data: session } = authClient.useSession();
  const userId = session?.user?.name || "anonymous"; // Use username from Better Auth
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const lastSyncedThreadId = useRef<string | null>(null);

  const { messages, sendMessage, isLoading, threadId } = useConvexChat({
    userId,
    threadId: selectedThreadId,
    agentType: "roast",
  });

  const { threads, deleteThread } = useConvexThreads(userId);

  // ALWAYS sync the active threadId back to selectedThreadId
  useEffect(() => {
    if (threadId && threadId !== lastSyncedThreadId.current) {
      lastSyncedThreadId.current = threadId;
      setSelectedThreadId(threadId);
    }
  }, [threadId]);

  const handleNewThread = () => {
    // Clear selected thread to create a new one
    setSelectedThreadId(null);
  };

  const handleThreadSelect = (newThreadId: string) => {
    setSelectedThreadId(newThreadId);
  };

  const handleDeleteThread = async (threadIdToDelete: string) => {
    await deleteThread(threadIdToDelete);
    // If we deleted the current thread, clear selection
    if (threadIdToDelete === selectedThreadId) {
      setSelectedThreadId(null);
    }
  };

  return (
    <UsernameAuthWrapper>
      <div className="h-full w-full flex overflow-hidden relative min-h-0 min-w-0">
        {/* OAuth Popup Handler - automatically opens auth popups */}
        <OAuthPopupHandler messages={messages} />

        <ConvexChatLayout
          messages={messages}
          threads={threads}
          currentThreadId={threadId}
          isPending={isLoading}
          agentName="RoastMaster"
          onSendMessage={sendMessage}
          onThreadSelect={handleThreadSelect}
          onNewThread={handleNewThread}
          onDeleteThread={handleDeleteThread}
        />
      </div>
    </UsernameAuthWrapper>
  );
}
