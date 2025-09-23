"use client";

import {
  MessageInput,
  MessageInputTextarea,
  MessageInputToolbar,
  MessageInputSubmitButton,
  MessageInputError,
  MessageInputMcpConfigButton,
} from "@/components/tambo/message-input";
import type { messageVariants } from "@/components/tambo/message";
import {
  ThreadHistory,
  ThreadHistoryHeader,
  ThreadHistoryNewButton,
  ThreadHistoryLibraryButton,
  ThreadHistoryChatButton,
  ThreadHistorySearch,
  ThreadHistoryList,
} from "@/components/tambo/thread-history";
import {
  ThreadContent,
  ThreadContentMessages,
  ThreadContentComponents,
} from "@/components/tambo/thread-content";
import { Sidebar, DesktopSidebar } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { usePinterestAuth } from "@/hooks/use-auth";
import type { VariantProps } from "class-variance-authority";
import * as React from "react";
import { useState, useCallback, useRef } from "react";
import { LibraryPanel } from "@/components/pinterest/library-panel";
import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * Props for the MessageThreadFull component
 */
export interface MessageThreadFullProps
  extends React.HTMLAttributes<HTMLDivElement> {
  /** Optional context key for the thread */
  contextKey?: string;
  /**
   * Controls the visual styling of messages in the thread.
   * Possible values include: "default", "compact", etc.
   * These values are defined in messageVariants from "@/components/tambo/message".
   * @example variant="compact"
   */
  variant?: VariantProps<typeof messageVariants>["variant"];
  /** Optional custom center content to render instead of chat messages */
  centerContent?: React.ReactNode;
  /** Hide the main bottom input bar in the center area */
  hideMainInput?: boolean;
  /** Whether the right chat sidebar should be open by default */
  defaultRightSidebarVisible?: boolean;
}

/**
 * A full-screen chat thread component with 3-column layout: sidebar | components | chat
 */
export const MessageThreadFull = React.forwardRef<
  HTMLDivElement,
  MessageThreadFullProps
>(({ contextKey, variant, centerContent, hideMainInput = false, defaultRightSidebarVisible = false }, ref) => {
  const [sidebarWidth, setSidebarWidth] = useState(384); // Default width (right sidebar)
  const [sidebarVisible, setSidebarVisible] = useState(defaultRightSidebarVisible); // Right sidebar default state
  const [leftSidebarVisible, setLeftSidebarVisible] = useState(true); // Left thread sidebar
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const { user, isAuthenticated, signOut, signIn } = usePinterestAuth();

  // Determine render mode based on sidebar width
  // Full mode: > 600px (components render in sidebar)
  // Half mode: <= 600px (components render in center)
  const isFullMode = sidebarWidth > 600;
  const minWidth = 280;
  const maxWidth = 800;

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
    
    const startX = e.clientX;
    const startWidth = sidebarWidth;

    const handleMouseMove = (e: MouseEvent) => {
      const newWidth = Math.min(Math.max(startWidth - (e.clientX - startX), minWidth), maxWidth);
      setSidebarWidth(newWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [sidebarWidth, minWidth, maxWidth]);

  const toggleSidebar = useCallback(() => {
    setSidebarVisible(!sidebarVisible);
  }, [sidebarVisible]);


  return (
    <div ref={ref} className={`flex w-full h-full overflow-hidden no-thread-reserve bg-neutral-100 ${isResizing ? 'cursor-col-resize' : ''}`}>
      {/* Left Sidebar - Thread History (shadcn/aceternity). Fully hides when closed. */}
      {leftSidebarVisible && (
        <div className="hidden lg:flex flex-shrink-0 h-full">
          {/* Keep sidebar fully open (fixed width), no hover-collapse */}
          <Sidebar open animate={false}>
            <DesktopSidebar className="w-[300px] bg-neutral-100 dark:bg-neutral-800 p-4 pr-3">
              <div className="relative flex flex-col h-full">
                {/* Close button - pinned to absolute top-right inside the sidebar */}
                <button
                  onClick={() => setLeftSidebarVisible(false)}
                  className="absolute top-2 right-2 z-10 text-muted-foreground hover:text-foreground p-1 rounded"
                  aria-label="Close sidebar"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>

                {/* Thread management + Library */}
                <div className="flex-1 min-h-0 overflow-auto px-4 pt-6 pb-2 space-y-4">
                  <ThreadHistory contextKey={contextKey} position="left" defaultCollapsed={false} externalLayout>
                    <div className="text-sm text-muted-foreground mb-2">Tambo Conversations</div>
                    <ThreadHistoryNewButton />
                    <ThreadHistoryChatButton />
                    <ThreadHistoryLibraryButton />
                    <ThreadHistorySearch />
                    <ThreadHistoryList className="mt-1" />
                  </ThreadHistory>

                  <div className="border-t pt-4">
                    <LibraryPanel />
                  </div>
                </div>

                {/* Bottom section: user controls only (prompt stays in right sidebar or center) */}
                <div className="px-4 pb-4 pt-4 bg-transparent">
                  <div className="space-y-2">
                    <Button variant="outline" className="w-full justify-start focus-visible:outline-none focus-visible:ring-0" disabled={!isAuthenticated}>
                      {user?.username || "Guest"}
                    </Button>
                    {isAuthenticated ? (
                      <Button variant="outline" className="w-full focus-visible:outline-none focus-visible:ring-0" onClick={signOut}>Sign out</Button>
                    ) : (
                      <Button variant="outline" className="w-full focus-visible:outline-none focus-visible:ring-0" onClick={signIn}>Sign in</Button>
                    )}
                  </div>
                </div>
              </div>
            </DesktopSidebar>
          </Sidebar>
        </div>
      )}

      {/* Main Content Area (content surface with conditional rounded top-left and border when left sidebar is open) */}
      <div className="flex-1 flex flex-col relative min-w-0 overflow-hidden">
        <div className={`relative flex flex-col h-full w-full bg-background shadow-sm ${leftSidebarVisible ? 'rounded-tl-3xl border-l border-border' : 'rounded-tl-none border-l-0'}`}>
        
        {/* Center area: keep mounted to avoid reloading embeds when toggling right sidebar */}
        <div className={cn("flex-1 flex overflow-hidden", centerContent ? "items-stretch justify-stretch" : "items-center justify-center") }>
          <div className={cn("w-full h-full flex flex-col overflow-hidden", centerContent ? "max-w-none" : "max-w-4xl") }>
            <div className={cn("flex-1 overflow-y-auto overflow-x-hidden p-4", hideMainInput ? "pb-4" : "pb-32") }>
              {centerContent ? (
                <div className="w-full h-full">{centerContent}</div>
              ) : (
                sidebarVisible && !isFullMode ? (
                  <ThreadContent variant={variant} renderMode="half">
                    <ThreadContentComponents />
                  </ThreadContent>
                ) : (
                  <ThreadContent variant={variant} renderMode="full">
                    <ThreadContentMessages />
                  </ThreadContent>
                )
              )}
            </div>
          </div>
        </div>

        {/* Input Bar - Absolutely fixed at bottom (only when not hidden) */}
        {!hideMainInput && !sidebarVisible && (
          <div className="absolute bottom-0 left-0 right-0 bg-background p-2 flex justify-center z-[9999]">
            <div className="w-full max-w-4xl">
              <MessageInput contextKey={contextKey}>
                <MessageInputTextarea />
                <MessageInputToolbar>
                  <MessageInputMcpConfigButton />
                  <MessageInputSubmitButton />
                </MessageInputToolbar>
                <MessageInputError />
              </MessageInput>
            </div>
          </div>
        )}
        </div>
      </div>

      {/* Right Sidebar - Resizable (only when visible) */}
      {sidebarVisible && (
        <div 
          ref={sidebarRef}
          className="bg-neutral-100 dark:bg-neutral-800 flex-shrink-0 flex flex-col relative overflow-hidden shadow-sm p-4 pl-3"
          style={{ width: sidebarWidth }}
        >
          {/* Resize Handle */}
          <div
            className="absolute left-0 top-0 h-full w-1 cursor-col-resize bg-transparent hover:bg-primary/20 transition-colors z-10"
            onMouseDown={handleMouseDown}
          />
          
          {/* Sidebar Content (no inner white card; rail itself is the container) */}
          <div className="flex flex-col h-full relative overflow-hidden px-0">
            {/* Simple close arrow at top */}
            <button
              onClick={toggleSidebar}
              className="absolute top-2 left-2 z-10 text-muted-foreground hover:text-foreground"
              aria-label="Close chat sidebar"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            
            {/* Chat Messages - only this scrolls */}
            <div className="flex-1 overflow-y-auto overflow-x-hidden px-4 pt-6 pb-2">
              <ThreadContent variant={variant} renderMode={isFullMode ? "full" : "half"}>
                <ThreadContentMessages />
              </ThreadContent>
            </div>

            {/* Prompt bar in right sidebar; rail background shows behind */}
            <div className="bg-transparent px-4 pb-4 pt-2 flex-shrink-0 z-[9999]">
              <div className="w-full max-w-3xl mx-auto">
                <MessageInput contextKey={contextKey}>
                  <MessageInputTextarea />
                  <MessageInputToolbar>
                    <MessageInputMcpConfigButton />
                    <MessageInputSubmitButton />
                  </MessageInputToolbar>
                  <MessageInputError />
                </MessageInput>
              </div>
            </div>
          </div>
        </div>
      )}

          {/* Toggle button when RIGHT sidebar is hidden - top-right */}
      {!sidebarVisible && (
        <button
          onClick={toggleSidebar}
          className="fixed right-2 top-2 text-muted-foreground hover:text-foreground z-10"
          aria-label="Open chat sidebar"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
      )}

      {/* Toggle button when LEFT sidebar is hidden */}
      {!leftSidebarVisible && (
        <button
          onClick={() => setLeftSidebarVisible(true)}
          className="fixed left-2 top-2 text-muted-foreground hover:text-foreground z-10"
          aria-label="Open thread sidebar"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      )}
    </div>
  );
});
MessageThreadFull.displayName = "MessageThreadFull";
