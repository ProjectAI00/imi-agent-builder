"use client";

import { cn } from "@/lib/utils";
import { createMarkdownComponents } from "@/components/tambo/markdown-components";
import * as React from "react";
import { useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp?: number;
  status?: string;
}

interface ConvexMessagesProps {
  messages: Message[];
  agentName?: string;
  className?: string;
}

const LoadingIndicator = () => (
  <div className="flex items-center gap-1">
    <span className="w-1 h-1 bg-current rounded-full animate-bounce [animation-delay:-0.3s]"></span>
    <span className="w-1 h-1 bg-current rounded-full animate-bounce [animation-delay:-0.2s]"></span>
    <span className="w-1 h-1 bg-current rounded-full animate-bounce [animation-delay:-0.1s]"></span>
  </div>
);

/**
 * Split assistant messages into separate bubbles based on natural breaks
 * Looks for patterns like "On it! 🔍" followed by longer analysis
 */
function splitAssistantMessage(content: string): string[] {
  // Don't split very short messages
  if (content.length < 50) {
    return [content];
  }

  // Split on double newlines (paragraph breaks)
  const paragraphs = content.split(/\n\n+/).filter(p => p.trim());

  // If there are 2+ paragraphs, split them into separate bubbles
  if (paragraphs.length >= 2) {
    // First paragraph is usually acknowledgment, rest is analysis
    // Split into: [first paragraph, rest combined]
    return [paragraphs[0], paragraphs.slice(1).join('\n\n')];
  }

  // Also check for single newline breaks between short acknowledgment and longer text
  const lines = content.split(/\n/).filter(l => l.trim());
  if (lines.length >= 2 && lines[0].length < 150) {
    return [lines[0], lines.slice(1).join('\n')];
  }

  return [content];
}

export function ConvexMessages({
  messages,
  agentName = "Imi",
  className,
}: ConvexMessagesProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  if (messages.length === 0) {
    return null;
  }

  // Split assistant messages into separate bubbles
  const expandedMessages = messages.flatMap((message, originalIndex) => {
    if (message.role === "assistant" && message.content) {
      const splits = splitAssistantMessage(message.content);
      return splits.map((content, splitIndex) => ({
        ...message,
        id: `${message.id}-split-${splitIndex}`,
        content,
        _originalIndex: originalIndex,
        _splitIndex: splitIndex,
      }));
    }
    return [{ ...message, _originalIndex: originalIndex, _splitIndex: 0 }];
  });

  return (
    <div className={cn("flex flex-col gap-4 w-full", className)}>
      {expandedMessages.map((message, index) => {
        const isLoading = message.status === "pending" && index === expandedMessages.length - 1;

      return (
        <div
          key={`${message.id}-${message.role}-${index}`}
          data-message-role={message.role}
          data-message-id={message.id}
        >
          <div
            className={cn(
              "flex w-full",
              message.role === "user" ? "justify-end" : "justify-start"
            )}
          >
            <div
              className={cn(
                "flex flex-col",
                message.role === "user" ? "max-w-[60%]" : "max-w-[60%]"
              )}
            >
              <div
                className={cn(
                  "relative block rounded-3xl px-4 py-2 text-[15px] leading-relaxed transition-all duration-200 font-medium max-w-full [&_p]:py-1 [&_ul]:py-4 [&_ol]:py-4 [&_li]:list-item",
                  message.role === "user"
                    ? "text-white bg-[var(--user-bubble)] font-sans"
                    : "text-white bg-[oklch(0.32_0_0_/_.9)] font-sans"
                )}
              >
                {isLoading && !message.content ? (
                  <div className="flex items-center justify-start h-4 py-1">
                    <LoadingIndicator />
                  </div>
                ) : (
                  <div className="break-words">
                    <ReactMarkdown components={createMarkdownComponents()}>
                      {message.content}
                    </ReactMarkdown>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      );
    })}
      <div ref={bottomRef} />
    </div>
  );
}
