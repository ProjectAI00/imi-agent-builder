"use client";

import * as React from "react";
import { TamboProvider } from "@tambo-ai/react";
import { TamboMcpProvider } from "@tambo-ai/react/mcp";
import { components, tools } from "@/lib/tambo";
import { useMcpServers } from "@/components/tambo/mcp-config-modal";
import { usePinterestAuth } from "@/hooks/use-auth";
import { AuthWrapper } from "@/components/auth/auth-wrapper";
import { MessageThreadFull } from "@/components/tambo/message-thread-full";
import { LibraryCanvas } from "@/components/pinterest/library-canvas";

export default function LibraryPage() {
  const mcpServers = useMcpServers();
  const { user } = usePinterestAuth();

  return (
    <AuthWrapper>
      <div className="h-full w-full flex overflow-hidden relative min-h-0 min-w-0">
        <TamboProvider
          apiKey={process.env.NEXT_PUBLIC_TAMBO_API_KEY!}
          userToken={user?.token}
          components={components}
          tools={tools}
          tamboUrl={process.env.NEXT_PUBLIC_TAMBO_URL}
        >
          {mcpServers.length > 0 ? (
            <TamboMcpProvider mcpServers={mcpServers}>
              <MessageThreadFull
                contextKey="pinterest-library"
                centerContent={<LibraryCanvas />}
                hideMainInput
                defaultRightSidebarVisible
              />
            </TamboMcpProvider>
          ) : (
            <MessageThreadFull
              contextKey="pinterest-library"
              centerContent={<LibraryCanvas />}
              hideMainInput
              defaultRightSidebarVisible
            />
          )}
        </TamboProvider>
      </div>
    </AuthWrapper>
  );
}
