"use client";

import { useConvexChat } from "@/hooks/use-convex-chat";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

/**
 * Convex Chat Demo Page
 *
 * This page demonstrates the Convex backend integration with a simple chat interface.
 */
export default function ConvexChatPage() {
  const [input, setInput] = useState("");
  const [agentType, setAgentType] = useState<"casual" | "professional">("casual");

  const { messages, sendMessage, isLoading, threadId } = useConvexChat({
    userId: "demo-user",
    contextKey: "demo-chat",
    agentType,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const message = input;
    setInput("");

    try {
      await sendMessage(message);
    } catch (error) {
      console.error("Failed to send message:", error);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Convex Chat Demo</h1>
          <p className="text-gray-600">
            Testing Convex backend with Luna (casual) and Assistant (professional)
          </p>
          {threadId && (
            <p className="text-sm text-gray-500 mt-2">
              Thread ID: <code className="bg-gray-100 px-2 py-1 rounded">{threadId}</code>
            </p>
          )}
        </div>

        {/* Agent Selector */}
        <div className="mb-4 flex gap-2">
          <Button
            variant={agentType === "casual" ? "default" : "outline"}
            onClick={() => setAgentType("casual")}
          >
            🌙 Luna (Casual)
          </Button>
          <Button
            variant={agentType === "professional" ? "default" : "outline"}
            onClick={() => setAgentType("professional")}
          >
            💼 Assistant (Professional)
          </Button>
        </div>

        {/* Messages */}
        <Card className="mb-4 p-4 h-[500px] overflow-y-auto">
          {messages.length === 0 ? (
            <div className="flex items-center justify-center h-full text-gray-400">
              <p>No messages yet. Start chatting!</p>
            </div>
          ) : (
            <div className="space-y-4">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${
                    msg.role === "user" ? "justify-end" : "justify-start"
                  }`}
                >
                  <div
                    className={`max-w-[70%] rounded-lg px-4 py-2 ${
                      msg.role === "user"
                        ? "bg-blue-500 text-white"
                        : "bg-gray-200 text-gray-900"
                    }`}
                  >
                    <div className="text-xs opacity-70 mb-1">
                      {msg.role === "user" ? "You" : agentType === "casual" ? "Luna" : "Assistant"}
                    </div>
                    <div className="whitespace-pre-wrap">{msg.content}</div>
                    {msg.status === "pending" && (
                      <div className="text-xs opacity-70 mt-1">Typing...</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Input */}
        <form onSubmit={handleSubmit} className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={
              agentType === "casual"
                ? "Ask Luna something..."
                : "Ask Assistant something..."
            }
            disabled={isLoading}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <Button type="submit" disabled={isLoading || !input.trim()}>
            {isLoading ? "Sending..." : "Send"}
          </Button>
        </form>

        {/* Info */}
        <div className="mt-8 p-4 bg-blue-50 rounded-lg">
          <h2 className="font-semibold mb-2">✨ Features Enabled:</h2>
          <ul className="space-y-1 text-sm text-gray-700">
            <li>✅ Real-time message streaming</li>
            <li>✅ Twitter search tool</li>
            <li>✅ Pinterest search tool</li>
            <li>✅ Usage tracking</li>
            <li>✅ Two agent personalities</li>
          </ul>
        </div>
      </div>
    </div>
  );
}