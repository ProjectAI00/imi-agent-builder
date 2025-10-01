"use client";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";
import { ChevronLeft, Plus, MessageSquare, Trash2 } from "lucide-react";
import * as React from "react";
import { useState } from "react";

interface Thread {
  id: string;
  title?: string;
  contextKey?: string;
  lastMessageTime?: number;
  messageCount?: number;
}

interface ConvexThreadSidebarProps {
  threads: Thread[];
  currentThreadId?: string | null;
  onThreadSelect: (threadId: string) => void;
  onNewThread: () => void;
  onDeleteThread?: (threadId: string) => void;
  onClose?: () => void;
  visible?: boolean;
  className?: string;
}

export function ConvexThreadSidebar({
  threads,
  currentThreadId,
  onThreadSelect,
  onNewThread,
  onDeleteThread,
  onClose,
  visible = true,
  className,
}: ConvexThreadSidebarProps) {
  if (!visible) return null;

  const formatTime = (timestamp?: number) => {
    if (!timestamp) return "";
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const hours = Math.floor(diff / 1000 / 60 / 60);
    
    if (hours < 1) return "Just now";
    if (hours < 24) return `${hours}h ago`;
    return date.toLocaleDateString();
  };

  return (
    <div
      className={cn(
        "flex flex-col h-full w-[300px] bg-[var(--sidebar)] rounded-tr-3xl",
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4">
        <h2 className="text-sm font-semibold">Conversations</h2>
        {onClose && (
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground p-1 rounded"
            aria-label="Close sidebar"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* New Thread Button */}
      <div className="p-4">
        <Button
          onClick={onNewThread}
          variant="outline"
          className="w-full justify-start gap-2"
        >
          <Plus className="w-4 h-4" />
          New Conversation
        </Button>
      </div>

      {/* Thread List */}
      <div className="flex-1 overflow-y-auto px-2">
        {threads.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground p-4">
            <MessageSquare className="w-8 h-8 mb-2 opacity-50" />
            <p className="text-sm">No conversations yet</p>
            <p className="text-xs mt-1">Start a new one above</p>
          </div>
        ) : (
          <div className="space-y-1">
            {threads.map((thread) => (
              <div
                key={thread.id}
                className={cn(
                  "group relative w-full text-left p-3 rounded-lg transition-colors",
                  "hover:bg-neutral-200 dark:hover:bg-neutral-700",
                  currentThreadId === thread.id
                    ? "bg-neutral-200 dark:bg-neutral-700"
                    : "bg-transparent"
                )}
              >
                <button
                  onClick={() => onThreadSelect(thread.id)}
                  className="w-full text-left"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">
                        {thread.title || thread.contextKey || "Untitled"}
                      </div>
                      {thread.messageCount !== undefined && (
                        <div className="text-xs text-muted-foreground mt-1">
                          {thread.messageCount} message{thread.messageCount !== 1 ? "s" : ""}
                        </div>
                      )}
                    </div>
                    {thread.lastMessageTime && (
                      <div className="text-xs text-muted-foreground whitespace-nowrap">
                        {formatTime(thread.lastMessageTime)}
                      </div>
                    )}
                  </div>
                </button>
                {onDeleteThread && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteThread(thread.id);
                    }}
                    className="absolute right-2 bottom-2 opacity-0 group-hover:opacity-100 p-1 hover:bg-red-100 dark:hover:bg-red-900/30 rounded transition-opacity"
                    aria-label="Delete thread"
                  >
                    <Trash2 className="w-4 h-4 text-red-600 dark:text-red-400" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Sign out footer */}
      <div className="p-4">
        <Button
          variant="outline"
          className="w-full bg-transparent text-[var(--foreground)] hover:opacity-80"
          onClick={() => authClient.signOut()}
        >
          Sign out
        </Button>
      </div>
    </div>
  );
}

