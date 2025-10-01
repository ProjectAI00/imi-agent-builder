"use client";

import { cn } from "@/lib/utils";
import { ChevronRight } from "lucide-react";
import * as React from "react";
import { useState } from "react";
import { ConvexMessageInput } from "./convex-message-input";
import { ConvexMessages } from "./convex-messages";
import { ConvexThreadSidebar } from "./convex-thread-sidebar";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp?: number;
  status?: string;
}

interface Thread {
  id: string;
  title?: string;
  contextKey?: string;
  lastMessageTime?: number;
  messageCount?: number;
}

interface ConvexChatLayoutProps {
  messages: Message[];
  threads: Thread[];
  currentThreadId?: string | null;
  isPending: boolean;
  agentName?: string;
  onSendMessage: (message: string) => Promise<void>;
  onThreadSelect: (threadId: string) => void;
  onNewThread: () => void;
  onDeleteThread?: (threadId: string) => void;
  className?: string;
}

export function ConvexChatLayout({
  messages,
  threads,
  currentThreadId,
  isPending,
  agentName = "Imi",
  onSendMessage,
  onThreadSelect,
  onNewThread,
  onDeleteThread,
  className,
}: ConvexChatLayoutProps) {
  const [sidebarVisible, setSidebarVisible] = useState(true);

  return (
    <div className={cn("flex w-full h-full overflow-hidden bg-[var(--sidebar)]", className)}>
      {/* Left Sidebar - Thread List */}
      <ConvexThreadSidebar
        threads={threads}
        currentThreadId={currentThreadId}
        onThreadSelect={onThreadSelect}
        onNewThread={onNewThread}
        onDeleteThread={onDeleteThread}
        onClose={() => setSidebarVisible(false)}
        visible={sidebarVisible}
      />

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col relative min-w-0 overflow-hidden">
        <div className="relative flex flex-col h-full w-full bg-[var(--sidebar)] rounded-tl-3xl">
          {/* Messages (center column, limited width) */}
          <div className="flex-1 overflow-y-auto">
            <div className="w-full max-w-4xl mx-auto px-4">
              <ConvexMessages messages={messages} agentName={agentName} />
            </div>
          </div>

          {/* Input Bar (remove top border to match Tambo) */}
          <div className="p-4">
            <div className="max-w-4xl mx-auto">
              <ConvexMessageInput onSend={onSendMessage} isPending={isPending} />
            </div>
          </div>
        </div>
      </div>

      {/* Toggle Sidebar Button */}
      {!sidebarVisible && (
        <button
          onClick={() => setSidebarVisible(true)}
          className="fixed left-2 top-2 text-muted-foreground hover:text-foreground z-10 p-1 rounded"
          aria-label="Open thread sidebar"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}
