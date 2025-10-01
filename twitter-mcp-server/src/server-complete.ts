#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ErrorCode,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import type { CallToolRequest } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { TwitterAPI } from './twitter-api.js';

// RapidAPI configuration via env
const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY || 'your_rapidapi_key_here';
const RAPIDAPI_HOST = process.env.RAPIDAPI_HOST || 'twitter-api-v1-1-enterprise.p.rapidapi.com';
const RAPIDAPI_BASE_URL = process.env.RAPIDAPI_BASE_URL || 'https://twitter-api-v1-1-enterprise.p.rapidapi.com';

const twitterAPI = new TwitterAPI({
  rapidApiKey: RAPIDAPI_KEY,
  rapidApiHost: RAPIDAPI_HOST,
  baseURL: RAPIDAPI_BASE_URL,
});

// Base schema for common parameters
const BaseParamsSchema = z.object({
  includeAuth: z.boolean().default(false).describe('Include authentication for write operations'),
  apiKeyOverride: z.string().optional().describe('Override API key'),
  authToken: z.string().optional().describe('Auth token for write operations'),
  ct0: z.string().optional().describe('CSRF token'),
});

// MCP server
const server = new Server(
  {
    name: 'twitter-mcp-server-complete',
    version: '2.0.0',
  },
  {
    capabilities: { tools: {} },
  }
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      // GENERIC TOOL
      {
        name: 'call_twitter_apitools',
        description: 'Generic call for /base/apitools/* endpoints. Can call any discovered endpoint directly.',
        inputSchema: {
          type: 'object',
          properties: {
            endpoint: { 
              type: 'string',
              description: 'Endpoint name (e.g., search, followersListV2, userTimeline, getToken, etc.)'
            },
            method: { type: 'string', enum: ['GET','POST'], default: 'GET' },
            params: { 
              type: 'object', 
              additionalProperties: true,
              description: 'Parameters to pass to the endpoint'
            },
            ...BaseParamsSchema.shape
          },
          required: ['endpoint'],
        },
      },

      // FOLLOWS CATEGORY (5 working tools)
      {
        name: 'twitter_get_followers',
        description: 'Get followers list for a user (returns full user objects)',
        inputSchema: {
          type: 'object',
          properties: {
            userId: { type: 'string', description: 'Twitter user ID' },
            count: { type: 'number', default: 20, minimum: 1, maximum: 200 },
            cursor: { type: 'string', description: 'Pagination cursor' }
          },
          required: ['userId']
        }
      },
      {
        name: 'twitter_get_following',
        description: 'Get following list for a user (returns full user objects)',
        inputSchema: {
          type: 'object',
          properties: {
            userId: { type: 'string', description: 'Twitter user ID' },
            count: { type: 'number', default: 20, minimum: 1, maximum: 200 },
            cursor: { type: 'string', description: 'Pagination cursor' }
          },
          required: ['userId']
        }
      },
      {
        name: 'twitter_get_follower_ids',
        description: 'Get follower IDs only (lightweight, faster)',
        inputSchema: {
          type: 'object',
          properties: {
            userId: { type: 'string', description: 'Twitter user ID' },
            count: { type: 'number', default: 100, minimum: 1, maximum: 5000 },
            cursor: { type: 'string', description: 'Pagination cursor' }
          },
          required: ['userId']
        }
      },
      {
        name: 'twitter_get_following_ids',
        description: 'Get following IDs only (lightweight, faster)',
        inputSchema: {
          type: 'object',
          properties: {
            userId: { type: 'string', description: 'Twitter user ID' },
            count: { type: 'number', default: 100, minimum: 1, maximum: 5000 },
            cursor: { type: 'string', description: 'Pagination cursor' }
          },
          required: ['userId']
        }
      },
      {
        name: 'twitter_get_blue_verified_followers',
        description: 'Get blue verified followers for a user',
        inputSchema: {
          type: 'object',
          properties: {
            userId: { type: 'string', description: 'Twitter user ID' },
            count: { type: 'number', default: 20, minimum: 1, maximum: 200 },
            cursor: { type: 'string', description: 'Pagination cursor' }
          },
          required: ['userId']
        }
      },
      {
        name: 'twitter_follow_user',
        description: 'Follow a user (requires authentication)',
        inputSchema: {
          type: 'object',
          properties: {
            userId: { type: 'string', description: 'Twitter user ID to follow' },
            username: { type: 'string', description: 'Twitter username to follow' },
            ...BaseParamsSchema.shape
          },
          anyOf: [{ required: ['userId'] }, { required: ['username'] }]
        }
      },
      {
        name: 'twitter_unfollow_user',
        description: 'Unfollow a user (requires authentication)',
        inputSchema: {
          type: 'object',
          properties: {
            userId: { type: 'string', description: 'Twitter user ID to unfollow' },
            username: { type: 'string', description: 'Twitter username to unfollow' },
            ...BaseParamsSchema.shape
          },
          anyOf: [{ required: ['userId'] }, { required: ['username'] }]
        }
      },

      // SEARCH CATEGORY (2 tools)
      {
        name: 'twitter_search',
        description: 'Search for tweets and users. Use words like "from:username" to get user tweets.',
        inputSchema: {
          type: 'object',
          properties: {
            words: { type: 'string', description: 'Search query (e.g., "from:elonmusk", "bitcoin", etc.)' },
            count: { type: 'number', default: 25, minimum: 1, maximum: 100 },
            topicId: { type: 'number', default: 702, description: 'Topic ID for search context' },
            lang: { type: 'string', description: 'Language code (optional)' }
          },
          required: ['words']
        }
      },
      {
        name: 'twitter_get_trends',
        description: 'Get trending topics (requires authentication)',
        inputSchema: {
          type: 'object',
          properties: {
            woeid: { type: 'number', description: 'Where On Earth ID (1 for worldwide)' },
            ...BaseParamsSchema.shape
          }
        }
      },

      // TWEETS CATEGORY (2 tools)
      {
        name: 'twitter_get_user_timeline',
        description: 'Get timeline/tweets for a specific user',
        inputSchema: {
          type: 'object',
          properties: {
            userId: { type: 'string', description: 'Twitter user ID' },
            username: { type: 'string', description: 'Twitter username (alternative to userId)' },
            count: { type: 'number', default: 25, minimum: 1, maximum: 200 },
            cursor: { type: 'string', description: 'Pagination cursor' }
          },
          anyOf: [{ required: ['userId'] }, { required: ['username'] }]
        }
      },
      {
        name: 'twitter_get_home_timeline',
        description: 'Get home timeline (requires authentication)',
        inputSchema: {
          type: 'object',
          properties: {
            count: { type: 'number', default: 25, minimum: 1, maximum: 200 },
            cursor: { type: 'string', description: 'Pagination cursor' },
            ...BaseParamsSchema.shape
          }
        }
      },

      // SEND TWEETS CATEGORY (2 tools)
      {
        name: 'twitter_create_tweet',
        description: 'Create/send a new tweet (requires authentication)',
        inputSchema: {
          type: 'object',
          properties: {
            text: { type: 'string', description: 'Tweet text content', maxLength: 280 },
            replyToTweetId: { type: 'string', description: 'Tweet ID to reply to (optional)' },
            ...BaseParamsSchema.shape
          },
          required: ['text']
        }
      },
      {
        name: 'twitter_create_retweet',
        description: 'Retweet an existing tweet (requires authentication)',
        inputSchema: {
          type: 'object',
          properties: {
            tweetId: { type: 'string', description: 'Tweet ID to retweet' },
            ...BaseParamsSchema.shape
          },
          required: ['tweetId']
        }
      },

      // AUTH CATEGORY (2 tools)
      {
        name: 'twitter_get_token',
        description: 'Get authentication token',
        inputSchema: {
          type: 'object',
          properties: {
            username: { type: 'string', description: 'Twitter username' },
            password: { type: 'string', description: 'Twitter password' }
          }
        }
      },
      {
        name: 'twitter_login',
        description: 'Login to Twitter (requires authentication)',
        inputSchema: {
          type: 'object',
          properties: {
            username: { type: 'string', description: 'Twitter username' },
            password: { type: 'string', description: 'Twitter password' },
            ...BaseParamsSchema.shape
          },
          required: ['username', 'password']
        }
      }
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request: CallToolRequest) => {
  try {
    const { name, arguments: args } = request.params;
    
    switch (name) {
      // GENERIC TOOL
      case 'call_twitter_apitools': {
        const { endpoint, method = 'GET', params = {}, includeAuth, apiKeyOverride, authToken, ct0 } = args as any;
        const res = await twitterAPI.callApiTools(endpoint, method, params, { includeAuth, apiKeyOverride, authToken, ct0 });
        return { content: [{ type: 'text', text: JSON.stringify(res, null, 2) }] };
      }

      // FOLLOWS CATEGORY
      case 'twitter_get_followers': {
        const { userId, count = 20, cursor } = args as any;
        const res = await twitterAPI.callApiTools('followersListV2', 'GET', {
          userId, count: Math.min(count, 200), ...(cursor && { cursor })
        });
        return { content: [{ type: 'text', text: JSON.stringify(res, null, 2) }] };
      }

      case 'twitter_get_following': {
        const { userId, count = 20, cursor } = args as any;
        const res = await twitterAPI.callApiTools('followingsListV2', 'GET', {
          userId, count: Math.min(count, 200), ...(cursor && { cursor })
        });
        return { content: [{ type: 'text', text: JSON.stringify(res, null, 2) }] };
      }

      case 'twitter_get_follower_ids': {
        const { userId, count = 100, cursor } = args as any;
        const res = await twitterAPI.callApiTools('followersIds', 'GET', {
          userId, count: Math.min(count, 5000), ...(cursor && { cursor })
        });
        return { content: [{ type: 'text', text: JSON.stringify(res, null, 2) }] };
      }

      case 'twitter_get_following_ids': {
        const { userId, count = 100, cursor } = args as any;
        const res = await twitterAPI.callApiTools('followingsIds', 'GET', {
          userId, count: Math.min(count, 5000), ...(cursor && { cursor })
        });
        return { content: [{ type: 'text', text: JSON.stringify(res, null, 2) }] };
      }

      case 'twitter_get_blue_verified_followers': {
        const { userId, count = 20, cursor } = args as any;
        const res = await twitterAPI.callApiTools('blueVerifiedFollowersV2', 'GET', {
          userId, count: Math.min(count, 200), ...(cursor && { cursor })
        });
        return { content: [{ type: 'text', text: JSON.stringify(res, null, 2) }] };
      }

      case 'twitter_follow_user': {
        const { userId, username, includeAuth = true, apiKeyOverride, authToken, ct0 } = args as any;
        const params = userId ? { userId } : { username };
        const res = await twitterAPI.callApiTools('follow', 'POST', params, { includeAuth, apiKeyOverride, authToken, ct0 });
        return { content: [{ type: 'text', text: JSON.stringify(res, null, 2) }] };
      }

      case 'twitter_unfollow_user': {
        const { userId, username, includeAuth = true, apiKeyOverride, authToken, ct0 } = args as any;
        const params = userId ? { userId } : { username };
        const res = await twitterAPI.callApiTools('unfollow', 'POST', params, { includeAuth, apiKeyOverride, authToken, ct0 });
        return { content: [{ type: 'text', text: JSON.stringify(res, null, 2) }] };
      }

      // SEARCH CATEGORY
      case 'twitter_search': {
        const { words, count = 25, topicId = 702, lang } = args as any;
        const res = await twitterAPI.callApiTools('search', 'GET', {
          words, count: Math.min(count, 100), topicId, ...(lang && { lang })
        });
        return { content: [{ type: 'text', text: JSON.stringify(res, null, 2) }] };
      }

      case 'twitter_get_trends': {
        const { woeid = 1, includeAuth = true, apiKeyOverride, authToken, ct0 } = args as any;
        const res = await twitterAPI.callApiTools('trends', 'GET', { woeid }, { includeAuth, apiKeyOverride, authToken, ct0 });
        return { content: [{ type: 'text', text: JSON.stringify(res, null, 2) }] };
      }

      // TWEETS CATEGORY
      case 'twitter_get_user_timeline': {
        const { userId, username, count = 25, cursor } = args as any;
        const params = userId ? { userId } : { username };
        const res = await twitterAPI.callApiTools('userTimeline', 'GET', {
          ...params, count: Math.min(count, 200), ...(cursor && { cursor })
        });
        return { content: [{ type: 'text', text: JSON.stringify(res, null, 2) }] };
      }

      case 'twitter_get_home_timeline': {
        const { count = 25, cursor, includeAuth = true, apiKeyOverride, authToken, ct0 } = args as any;
        const res = await twitterAPI.callApiTools('homeTimeline', 'GET', {
          count: Math.min(count, 200), ...(cursor && { cursor })
        }, { includeAuth, apiKeyOverride, authToken, ct0 });
        return { content: [{ type: 'text', text: JSON.stringify(res, null, 2) }] };
      }

      // SEND TWEETS CATEGORY
      case 'twitter_create_tweet': {
        const { text, replyToTweetId, includeAuth = true, apiKeyOverride, authToken, ct0 } = args as any;
        const params = { text, ...(replyToTweetId && { replyToTweetId }) };
        const res = await twitterAPI.callApiTools('createTweet', 'POST', params, { includeAuth, apiKeyOverride, authToken, ct0 });
        return { content: [{ type: 'text', text: JSON.stringify(res, null, 2) }] };
      }

      case 'twitter_create_retweet': {
        const { tweetId, includeAuth = true, apiKeyOverride, authToken, ct0 } = args as any;
        const res = await twitterAPI.callApiTools('createRetweet', 'POST', { tweetId }, { includeAuth, apiKeyOverride, authToken, ct0 });
        return { content: [{ type: 'text', text: JSON.stringify(res, null, 2) }] };
      }

      // AUTH CATEGORY
      case 'twitter_get_token': {
        const { username, password } = args as any;
        const res = await twitterAPI.callApiTools('getToken', 'GET', { username, password });
        return { content: [{ type: 'text', text: JSON.stringify(res, null, 2) }] };
      }

      case 'twitter_login': {
        const { username, password, includeAuth = true, apiKeyOverride, authToken, ct0 } = args as any;
        const res = await twitterAPI.callApiTools('login', 'POST', { username, password }, { includeAuth, apiKeyOverride, authToken, ct0 });
        return { content: [{ type: 'text', text: JSON.stringify(res, null, 2) }] };
      }

      default:
        throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new McpError(ErrorCode.InternalError, `Error executing tool: ${message}`);
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Twitter MCP server (COMPLETE) running on stdio');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}