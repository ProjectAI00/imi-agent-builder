"use client";

import { MessageThreadFull } from "@/components/tambo/message-thread-full";
import { useMcpServers } from "@/components/tambo/mcp-config-modal";
import { components, tools } from "@/lib/tambo";
import { TamboProvider } from "@tambo-ai/react";
import { TamboMcpProvider, MCPTransport } from "@tambo-ai/react/mcp";
import { AuthWrapper } from "@/components/auth/auth-wrapper";
import { usePinterestAuth } from "@/hooks/use-auth";
import { ensureTwitterMcpDefault } from "@/lib/mcp-defaults";
import React from "react";

export default function ChatPage() {
  // Load MCP server configurations
  // Ensure Twitter MCP server is auto-registered in localStorage (invisible onboarding)
  React.useEffect(() => {
    ensureTwitterMcpDefault();
  }, []);

  const mcpServers = useMcpServers();
  const { user } = usePinterestAuth();

  // Debug MCP servers
  React.useEffect(() => {
    console.log('🔍 MCP Servers:', mcpServers);
    console.log('🔍 MCP Servers length:', mcpServers.length);
    console.log('🔍 Will use TamboMcpProvider:', mcpServers.length > 0);
    
    // Test direct fetch to MCP server
    if (mcpServers.length > 0) {
      console.log('🧪 Testing direct fetch to MCP server...');
      
      // Test the direct MCP call
      fetch('http://localhost:3002', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'tools/list',
          params: {}
        })
      })
      .then(res => res.json())
      .then(data => console.log('✅ Direct MCP fetch successful:', data))
      .catch(err => console.error('❌ Direct MCP fetch failed:', err));
      
      // Test MCPClient.create directly to see if it fails
      import('@tambo-ai/react/mcp').then(async ({ MCPClient, MCPTransport }) => {
        try {
          console.log('🧪 Testing MCPClient.create...');
          const client = await MCPClient.create('http://localhost:3002', MCPTransport.HTTP);
          console.log('✅ MCPClient.create successful:', client);
          
          console.log('🧪 Testing MCPClient.listTools...');
          const tools = await client.listTools();
          console.log('✅ MCPClient.listTools successful:', tools);
        } catch (err) {
          console.error('❌ MCPClient test failed:', err);
        }
      });
    }
  }, [mcpServers]);

  return (
    <AuthWrapper>
      {/* Use full-size within parent instead of viewport units to avoid double height with header */}
      <div className="h-full w-full flex overflow-hidden relative min-h-0 min-w-0">
        <TamboProvider
          apiKey={process.env.NEXT_PUBLIC_TAMBO_API_KEY!}
          userToken={user?.token}
          components={components}
          tools={tools}
          tamboUrl={process.env.NEXT_PUBLIC_TAMBO_URL}
        >
          {mcpServers.length > 0 ? (
            <TamboMcpProvider mcpServers={[
              {
                url: "http://localhost:3002",
                transport: MCPTransport.HTTP,
                name: "twitter-mcp-server"
              }
            ]}>
              <MessageThreadFull contextKey="tambo-template" />
            </TamboMcpProvider>
          ) : (
            <MessageThreadFull contextKey="tambo-template" />
          )}
        </TamboProvider>
      </div>
    </AuthWrapper>
  );
}
