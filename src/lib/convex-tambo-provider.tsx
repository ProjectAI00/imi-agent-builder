"use client";

/**
 * Convex-Tambo Adapter
 *
 * Bridges Convex backend with Tambo UI components.
 * Provides Tambo-compatible hooks while using Convex under the hood.
 */

import React, { createContext, useContext, ReactNode } from "react";
import { TamboProvider } from "@tambo-ai/react";
import { useConvexChat } from "@/hooks/use-convex-chat";

interface ConvexTamboAdapterProps {
  children: ReactNode;
  userId: string;
}

export function ConvexTamboAdapter({
  children,
  userId,
}: ConvexTamboAdapterProps) {
  // This is a minimal Tambo provider just to satisfy the UI components
  // The actual backend calls go through Convex
  return (
    <TamboProvider
      apiKey={process.env.NEXT_PUBLIC_TAMBO_API_KEY || "dummy-key"}
      components={[]}
      tools={[]}
    >
      {children}
    </TamboProvider>
  );
}