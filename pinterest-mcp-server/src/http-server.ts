#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import {
  CallToolRequestSchema,
  CallToolRequest,
  ListToolsRequestSchema,
  ErrorCode,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import express from 'express';
import cors from 'cors';
import { z } from 'zod';
import { PinterestAPI } from './pinterest-api.js';
import { MockPinterestAPI } from './mock-pinterest-api.js';

// Pinterest API credentials
const PINTEREST_ACCESS_TOKEN = process.env.PINTEREST_ACCESS_TOKEN || 'your_pinterest_access_token_here';
const USE_MOCK_API = process.env.USE_MOCK_API !== 'false'; // Use mock by default
const PORT = process.env.PORT || 3001;

// Initialize Pinterest API client (use mock for development)
// Note: We'll create per-user API clients dynamically based on user tokens
const defaultPinterestAPI = USE_MOCK_API 
  ? new MockPinterestAPI() 
  : new PinterestAPI(PINTEREST_ACCESS_TOKEN);

// Function to get Pinterest API client for a specific user token
function getPinterestAPIForUser(userToken?: string): PinterestAPI | MockPinterestAPI {
  if (USE_MOCK_API) {
    return new MockPinterestAPI();
  }
  
  const token = userToken || PINTEREST_ACCESS_TOKEN;
  return new PinterestAPI(token);
}

// Tool argument schemas
const SearchPinsArgsSchema = z.object({
  query: z.string().describe('Search query for Pinterest pins'),
  limit: z.number().min(1).max(50).default(25).describe('Number of pins to return (max 50)'),
});

const GetBoardPinsArgsSchema = z.object({
  boardId: z.string().describe('Pinterest board ID'),
  limit: z.number().min(1).max(100).default(25).describe('Number of pins to return (max 100)'),
});

const GetPinArgsSchema = z.object({
  pinId: z.string().describe('Pinterest pin ID'),
});

// Create MCP server
const server = new Server(
  {
    name: 'pinterest-mcp-server',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Register tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'search_pinterest_pins',
        description: 'Search Pinterest pins by query and return visual content with metadata',
        inputSchema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'Search query for Pinterest pins (e.g., "modern kitchen design", "home decor ideas")',
            },
            limit: {
              type: 'number',
              description: 'Number of pins to return (1-50, default 25)',
              minimum: 1,
              maximum: 50,
              default: 25,
            },
          },
          required: ['query'],
        },
      },
      {
        name: 'get_user_boards',
        description: 'Get user\'s Pinterest boards',
        inputSchema: {
          type: 'object',
          properties: {
            limit: {
              type: 'number',
              description: 'Number of boards to return (1-100, default 25)',
              minimum: 1,
              maximum: 100,
              default: 25,
            },
          },
          required: [],
        },
      },
      {
        name: 'get_board_pins',
        description: 'Get pins from a specific Pinterest board',
        inputSchema: {
          type: 'object',
          properties: {
            boardId: {
              type: 'string',
              description: 'Pinterest board ID',
            },
            limit: {
              type: 'number',
              description: 'Number of pins to return (1-100, default 25)',
              minimum: 1,
              maximum: 100,
              default: 25,
            },
          },
          required: ['boardId'],
        },
      },
    ],
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request: CallToolRequest) => {
  try {
    const { name, arguments: args } = request.params;

    switch (name) {
      case 'search_pinterest_pins': {
        const { query, limit } = SearchPinsArgsSchema.parse(args);
        const pins = await pinterestAPI.searchPins(query, limit);
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                query,
                count: pins.length,
                pins: pins.map(pin => ({
                  id: pin.id,
                  title: pin.title,
                  description: pin.description,
                  imageUrl: pin.image?.['600x']?.url || pin.image?.original?.url,
                  imageWidth: pin.image?.['600x']?.width || pin.image?.original?.width,
                  imageHeight: pin.image?.['600x']?.height || pin.image?.original?.height,
                  link: pin.link,
                  boardName: pin.board?.name,
                  createdAt: pin.created_at,
                })),
              }, null, 2),
            },
          ],
        };
      }

      case 'get_user_boards': {
        const { limit = 25 } = args as { limit?: number };
        const boards = await pinterestAPI.getUserBoards(limit);
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                count: boards.length,
                boards: boards.map(board => ({
                  id: board.id,
                  name: board.name,
                  description: board.description,
                  pinCount: board.pin_count,
                  createdAt: board.created_at,
                })),
              }, null, 2),
            },
          ],
        };
      }

      case 'get_board_pins': {
        const { boardId, limit } = GetBoardPinsArgsSchema.parse(args);
        const pins = await pinterestAPI.getBoardPins(boardId, limit);
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                boardId,
                count: pins.length,
                pins: pins.map(pin => ({
                  id: pin.id,
                  title: pin.title,
                  description: pin.description,
                  imageUrl: pin.image?.['600x']?.url || pin.image?.original?.url,
                  imageWidth: pin.image?.['600x']?.width || pin.image?.original?.width,
                  imageHeight: pin.image?.['600x']?.height || pin.image?.original?.height,
                  link: pin.link,
                  createdAt: pin.created_at,
                })),
              }, null, 2),
            },
          ],
        };
      }

      default:
        throw new McpError(
          ErrorCode.MethodNotFound,
          `Unknown tool: ${name}`
        );
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new McpError(
      ErrorCode.InternalError,
      `Error executing tool: ${errorMessage}`
    );
  }
});

// Create Express app for HTTP transport
const app = express();
app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', server: 'pinterest-mcp-server' });
});

// SSE endpoint for MCP communication with user token support
app.use('/sse', async (req, res) => {
  // Extract user token from Authorization header
  const userToken = req.headers.authorization?.replace('Bearer ', '');
  console.log('MCP client connected via SSE', userToken ? 'with user token' : 'without user token');
  
  // Store user token in request for later use
  (req as any).userToken = userToken;
  
  const transport = new SSEServerTransport('/sse', res);
  await server.connect(transport);
});

// Start HTTP server
async function main() {
  app.listen(PORT, () => {
    console.log(`🎨 Pinterest MCP Server running on http://localhost:${PORT}`);
    console.log(`📡 SSE endpoint: http://localhost:${PORT}/sse`);
    console.log(`🏥 Health check: http://localhost:${PORT}/health`);
    console.log(`${USE_MOCK_API ? '🎭 Using MOCK Pinterest data' : '📌 Using REAL Pinterest API'}`);
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}