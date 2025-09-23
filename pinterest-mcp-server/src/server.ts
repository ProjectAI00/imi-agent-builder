#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  CallToolRequest,
  ListToolsRequestSchema,
  ErrorCode,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { PinterestAPI } from './pinterest-api.js';

// Pinterest API credentials (must be provided via env)
const PINTEREST_ACCESS_TOKEN = process.env.PINTEREST_ACCESS_TOKEN || '';
if (!PINTEREST_ACCESS_TOKEN) {
  console.error('[MCP SERVER] Missing PINTEREST_ACCESS_TOKEN env. Pinterest tools may fail until set.');
}

// Initialize Pinterest API client with real API only
console.error(`[MCP SERVER] Using REAL Pinterest API only`);
const pinterestAPI = new PinterestAPI(PINTEREST_ACCESS_TOKEN);

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
      {
        name: 'get_pinterest_pin',
        description: 'Get detailed information about a specific Pinterest pin',
        inputSchema: {
          type: 'object',
          properties: {
            pinId: {
              type: 'string',
              description: 'Pinterest pin ID',
            },
          },
          required: ['pinId'],
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

      case 'get_pinterest_pin': {
        const { pinId } = GetPinArgsSchema.parse(args);
        const pin = await pinterestAPI.getPin(pinId);
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                id: pin.id,
                title: pin.title,
                description: pin.description,
                imageUrl: pin.image?.['600x']?.url || pin.image?.original?.url,
                imageWidth: pin.image?.['600x']?.width || pin.image?.original?.width,
                imageHeight: pin.image?.['600x']?.height || pin.image?.original?.height,
                link: pin.link,
                boardName: pin.board?.name,
                createdAt: pin.created_at,
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

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Pinterest MCP server running on stdio');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}
