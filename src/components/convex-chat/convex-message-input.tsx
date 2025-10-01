"use client";

import { cn } from "@/lib/utils";
import { ArrowUp } from "lucide-react";
import * as React from "react";
import { useState, useRef, useEffect } from "react";

interface ConvexMessageInputProps {
  onSend: (message: string) => Promise<void>;
  isPending: boolean;
  className?: string;
}

export function ConvexMessageInput({
  onSend,
  isPending,
  className,
}: ConvexMessageInputProps) {
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!value.trim() || isPending) return;

    const messageText = value;
    setValue("");
    
    try {
      await onSend(messageText);
    } catch (error) {
      console.error("Failed to send message:", error);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [value]);

  // Auto-focus on mount
  useEffect(() => {
    if (textareaRef.current && !isPending) {
      textareaRef.current.focus();
    }
  }, [isPending]);

  return (
    <form onSubmit={handleSubmit} className={cn("w-full", className)}>
      <div className="flex flex-col rounded-xl bg-[var(--prompt-bg)] p-2 px-3">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="What do you want to do?"
          disabled={isPending}
          autoFocus
          className="flex-1 p-3 rounded-t-lg bg-[var(--prompt-bg)] text-foreground resize-none text-sm min-h-[82px] max-h-[40vh] focus:outline-none placeholder:text-muted-foreground/60 disabled:opacity-50 disabled:cursor-not-allowed"
        />
        <div className="flex justify-end mt-2 p-1">
          <button
            type="submit"
            disabled={!value.trim() || isPending}
            className={cn(
              "w-10 h-10 rounded-lg flex items-center justify-center transition-colors",
              value.trim() && !isPending
                ? "bg-black/80 text-white hover:bg-black/70"
                : "bg-black/50 text-white/50 cursor-not-allowed"
            )}
          >
            <ArrowUp className="h-4 w-4" />
          </button>
        </div>
      </div>
    </form>
  );
}
