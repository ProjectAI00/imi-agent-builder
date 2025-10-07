import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

interface ToolCall {
  tool_slug: string;
  arguments: Record<string, unknown>;
}

interface SearchToolsOptions {
  toolkits?: string[];
  limit?: number;
}

export class ToolRouterClient {
  private client: Client;
  private sessionUrl: string;
  private connected = false;

  constructor(sessionUrl: string) {
    this.sessionUrl = sessionUrl;
    this.client = new Client(
      {
        name: "convexhack-agent",
        version: "1.0.0",
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );
  }

  async connect(): Promise<void> {
    if (this.connected) {
      return;
    }

    const transport = new StreamableHTTPClientTransport(new URL(this.sessionUrl));
    await this.client.connect(transport);
    this.connected = true;
  }

  async searchTools(taskDescription: string, options?: SearchToolsOptions) {
    if (!this.connected) {
      await this.connect();
    }

    const result = await this.client.callTool({
      name: "COMPOSIO_SEARCH_TOOLS",
      arguments: {
        use_case: taskDescription,
        exploratory_query: false,
        known_fields: options?.toolkits?.join(",") || "",
        session: { generate_id: false },
      },
    });

    return (result.content as unknown[])[0];
  }

  async createPlan(useCase: string, toolSlugs: string[], knownFields = "") {
    if (!this.connected) {
      await this.connect();
    }

    const result = await this.client.callTool({
      name: "COMPOSIO_CREATE_PLAN",
      arguments: {
        use_case: useCase,
        primary_tool_slugs: toolSlugs,
        difficulty: "medium",
        known_fields: knownFields,
        reasoning: "Auto-generated plan for background task",
      },
    });

    return (result.content as unknown[])[0];
  }

  async executeTools(tools: ToolCall[]) {
    if (!this.connected) {
      await this.connect();
    }

    const result = await this.client.callTool({
      name: "COMPOSIO_MULTI_EXECUTE_TOOL",
      arguments: {
        tools: tools,
        sync_response_to_workbench: false,
        thought: "Background agent execution",
        memory: {},
      },
    });

    return (result.content as unknown[])[0];
  }

  async executePlan(planLogId: string, useCase: string) {
    if (!this.connected) {
      await this.connect();
    }

    const result = await this.client.callTool({
      name: "COMPOSIO_EXECUTE_PLAN",
      arguments: {
        log_id: planLogId,
        use_case: useCase,
        thought: "Executing planned workflow",
      },
    });

    return (result.content as unknown[])[0];
  }

  async manageConnections(toolkits: string[]) {
    if (!this.connected) {
      await this.connect();
    }

    const result = await this.client.callTool({
      name: "COMPOSIO_MANAGE_CONNECTIONS",
      arguments: {
        toolkits: toolkits,
        reinitiate_all: false,
      },
    });

    return (result.content as unknown[])[0];
  }

  async disconnect(): Promise<void> {
    if (this.connected) {
      await this.client.close();
      this.connected = false;
    }
  }
}
