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
import { TwitterAPI } from './twitter-api.ts';

// RapidAPI configuration via env
const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY || 'your_rapidapi_key_here';
const RAPIDAPI_HOST = process.env.RAPIDAPI_HOST || 'twitter-api-v1-1-enterprise.p.rapidapi.com';
const RAPIDAPI_BASE_URL = process.env.RAPIDAPI_BASE_URL || 'https://twitter-api-v1-1-enterprise.p.rapidapi.com';

const twitterAPI = new TwitterAPI({
  rapidApiKey: RAPIDAPI_KEY,
  rapidApiHost: RAPIDAPI_HOST,
  baseURL: RAPIDAPI_BASE_URL,
});

// Schemas
const SearchTweetsArgsSchema = z.object({
  query: z.string().describe('Search query for tweets'),
  limit: z.number().min(1).max(100).default(25).describe('Number of tweets to return (1-100)'),
  lang: z.string().optional().describe('Language code (optional)'),
});

const GetTweetArgsSchema = z.object({
  tweetId: z.string().describe('Tweet ID'),
});

const GetUserArgsSchema = z.object({
  username: z.string().describe('Twitter username (screen_name)'),
});

const GetUserTweetsArgsSchema = z.object({
  userId: z.string().optional().describe('User ID'),
  username: z.string().optional().describe('Twitter username (screen_name)'),
  limit: z.number().min(1).max(200).default(25),
});

const SendTweetArgsSchema = z.object({
  status: z.string().describe('Tweet text content'),
});

const FollowUserArgsSchema = z.object({
  userId: z.string().optional(),
  username: z.string().optional(),
}).refine(v => !!v.userId || !!v.username, { message: 'Provide userId or username' });

const SendDMArgsSchema = z.object({
  senderId: z.string(),
  recipientId: z.string(),
  text: z.string(),
});

const CallTwitterApiArgsSchema = z.object({
  method: z.enum(['GET','POST','PUT','PATCH','DELETE']).default('GET'),
  path: z.string().describe('Absolute path under base URL, e.g. /1.1/statuses/show.json'),
  query: z.record(z.any()).optional(),
  body: z.any().optional(),
});

const CallApiToolsArgsSchema = z.object({
  endpoint: z.string().describe('Endpoint name under /base/apitools, e.g., follow, retweetersV2, CommunitiesMemberV2'),
  method: z.enum(['GET', 'POST']).default('GET'),
  params: z.record(z.any()).optional(),
  includeAuth: z.boolean().default(false).describe('If true, include auth_token and ct0 from env or provided overrides'),
  apiKeyOverride: z.string().optional(),
  authToken: z.string().optional(),
  ct0: z.string().optional(),
}).passthrough();

// MCP server
const server = new Server(
  {
    name: 'twitter-mcp-server',
    version: '1.0.0',
  },
  {
    capabilities: { tools: {} },
  }
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      { name: 'twitter_communities_call', description: 'Call Twitter_Communities_api_tools endpoint under /base/apitools/*', inputSchema: { type: 'object', properties: { endpoint: { type: 'string' }, method: { type: 'string', enum: ['GET','POST'], default: 'GET' }, params: { type: 'object', additionalProperties: true }, includeAuth: { type: 'boolean' }, apiKeyOverride: { type: 'string' }, authToken: { type: 'string' }, ct0: { type: 'string' } }, required: ['endpoint'] } },
      { name: 'twitter_dms_call', description: 'Call Twitter_DMS_api_tools endpoint under /base/apitools/*', inputSchema: { type: 'object', properties: { endpoint: { type: 'string' }, method: { type: 'string', enum: ['GET','POST'], default: 'POST' }, params: { type: 'object', additionalProperties: true }, includeAuth: { type: 'boolean' }, apiKeyOverride: { type: 'string' }, authToken: { type: 'string' }, ct0: { type: 'string' } }, required: ['endpoint'] } },
      { name: 'twitter_follows_call', description: 'Call Twitter_Follows_api_tools endpoint under /base/apitools/*', inputSchema: { type: 'object', properties: { endpoint: { type: 'string' }, method: { type: 'string', enum: ['GET','POST'], default: 'POST' }, params: { type: 'object', additionalProperties: true }, includeAuth: { type: 'boolean' }, apiKeyOverride: { type: 'string' }, authToken: { type: 'string' }, ct0: { type: 'string' } }, required: ['endpoint'] } },
      { name: 'twitter_notifications_call', description: 'Call Twitter_Get_Notifications_api_tools endpoint under /base/apitools/*', inputSchema: { type: 'object', properties: { endpoint: { type: 'string' }, method: { type: 'string', enum: ['GET','POST'], default: 'GET' }, params: { type: 'object', additionalProperties: true }, includeAuth: { type: 'boolean' }, apiKeyOverride: { type: 'string' }, authToken: { type: 'string' }, ct0: { type: 'string' } }, required: ['endpoint'] } },
      { name: 'twitter_get_twees_call', description: 'Call Twitter_Get_Twees_api_tools endpoint under /base/apitools/*', inputSchema: { type: 'object', properties: { endpoint: { type: 'string' }, method: { type: 'string', enum: ['GET','POST'], default: 'GET' }, params: { type: 'object', additionalProperties: true }, includeAuth: { type: 'boolean' }, apiKeyOverride: { type: 'string' }, authToken: { type: 'string' }, ct0: { type: 'string' } }, required: ['endpoint'] } },
      { name: 'twitter_lists_call', description: 'Call Twitter_List_api_tools endpoint under /base/apitools/*', inputSchema: { type: 'object', properties: { endpoint: { type: 'string' }, method: { type: 'string', enum: ['GET','POST'], default: 'GET' }, params: { type: 'object', additionalProperties: true }, includeAuth: { type: 'boolean' }, apiKeyOverride: { type: 'string' }, authToken: { type: 'string' }, ct0: { type: 'string' } }, required: ['endpoint'] } },
      { name: 'twitter_login_get_token_call', description: 'Call Twitter_LoginGetToken_api_tools endpoint under /base/apitools/*', inputSchema: { type: 'object', properties: { endpoint: { type: 'string' }, method: { type: 'string', enum: ['GET','POST'], default: 'POST' }, params: { type: 'object', additionalProperties: true }, includeAuth: { type: 'boolean' }, apiKeyOverride: { type: 'string' }, authToken: { type: 'string' }, ct0: { type: 'string' } }, required: ['endpoint'] } },
      { name: 'twitter_search_call', description: 'Call Twitter_Search_api_tools endpoint under /base/apitools/*', inputSchema: { type: 'object', properties: { endpoint: { type: 'string' }, method: { type: 'string', enum: ['GET','POST'], default: 'GET' }, params: { type: 'object', additionalProperties: true }, includeAuth: { type: 'boolean' }, apiKeyOverride: { type: 'string' }, authToken: { type: 'string' }, ct0: { type: 'string' } }, required: ['endpoint'] } },
      { name: 'twitter_send_twees_call', description: 'Call Twitter_Send_Twees_api_tools endpoint under /base/apitools/*', inputSchema: { type: 'object', properties: { endpoint: { type: 'string' }, method: { type: 'string', enum: ['GET','POST'], default: 'POST' }, params: { type: 'object', additionalProperties: true }, includeAuth: { type: 'boolean' }, apiKeyOverride: { type: 'string' }, authToken: { type: 'string' }, ct0: { type: 'string' } }, required: ['endpoint'] } },
      { name: 'twitter_users_call', description: 'Call Twitter_Users_api_tools endpoint under /base/apitools/*', inputSchema: { type: 'object', properties: { endpoint: { type: 'string' }, method: { type: 'string', enum: ['GET','POST'], default: 'GET' }, params: { type: 'object', additionalProperties: true }, includeAuth: { type: 'boolean' }, apiKeyOverride: { type: 'string' }, authToken: { type: 'string' }, ct0: { type: 'string' } }, required: ['endpoint'] } },
      {
        name: 'call_twitter_apitools',
        description: 'Generic call for /base/apitools/* endpoints. Examples: followers → endpoint "users/followers" with { username, count } OR "/users/by/username/<name>/followers" with { count }',
        inputSchema: {
          type: 'object',
          additionalProperties: true,
          properties: {
            endpoint: { type: 'string' },
            method: { type: 'string', enum: ['GET','POST'], default: 'GET' },
            params: { type: 'object', additionalProperties: true, properties: { username: { type: 'string' }, screen_name: { type: 'string' }, userId: { type: 'string' }, user_id: { type: 'string' }, count: { type: 'number' }, cursor: { type: 'string' }, words: { type: 'string' }, topicId: { type: 'number' } } },
            includeAuth: { type: 'boolean', default: false },
            apiKeyOverride: { type: 'string' },
            authToken: { type: 'string' },
            ct0: { type: 'string' },
            username: { type: 'string' },
            screen_name: { type: 'string' },
            userId: { type: 'string' },
            user_id: { type: 'string' },
            count: { type: 'number' },
            cursor: { type: 'string' },
            words: { type: 'string' },
            topicId: { type: 'number' },
          },
          required: ['endpoint'],
        },
      },
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request: CallToolRequest) => {
  try {
    const { name, arguments: args } = request.params;
    switch (name) {
      
      
      case 'call_twitter_apitools': {
        const parsed = CallApiToolsArgsSchema.parse(args) as any;
        const { endpoint, method, params, includeAuth, apiKeyOverride, authToken, ct0, ...rest } = parsed;
        const mergedParams = { ...(params || {}), ...rest } as Record<string, any>;

        async function mapAndCall(ep: string, mth: 'GET'|'POST', p: Record<string, any> = {}) {
          const internalKey = process.env.RAPIDAPI_TWITTER_APIKEY || process.env.TWITTER_INTERNAL_API_KEY;
          const mergedParams = { ...(p || {}) } as Record<string, any>;
          if (!('apiKey' in mergedParams) && internalKey) mergedParams.apiKey = internalKey;
          if (!('resFormat' in mergedParams)) mergedParams.resFormat = 'json';

          let name = ep;
          if (name.startsWith('/base/apitools/')) name = name.replace('/base/apitools/', '');

          const lower = name.toLowerCase();
          // Supported official-style patterns (with and without leading slash)
          const usernameFollowing = lower.match(/^\/?users\/by\/username\/([^/]+)\/following$/);
          const usernameFollowers = lower.match(/^\/?users\/by\/username\/([^/]+)\/followers$/);
          const usernameOnly = lower.match(/^\/?users\/by\/username\/([^/]+)$/);
          const idFollowing = lower.match(/^\/?users\/(\d+)\/following$/);
          const idFollowers = lower.match(/^\/?users\/(\d+)\/followers$/);

          async function resolveUserId(un: string): Promise<string> {
            const searchRes = await twitterAPI.callApiTools('search', 'GET', {
              words: `from:${un}`,
              count: 1,
              topicId: 702,
              apiKey: mergedParams.apiKey,
              resFormat: 'json',
            });
            const instructions = (((((searchRes || {}).data || {}).data || {}).search_by_raw_query || {}).search_timeline || {}).timeline?.instructions || [];
            for (const ins of instructions) {
              const entries = (ins as any).entries || (ins as any)?.addEntries?.entries || [];
              for (const e of entries) {
                const it = e?.content?.itemContent;
                const restId = it?.tweet_results?.result?.core?.user_results?.result?.rest_id;
                if (restId) return String(restId);
              }
            }
            throw new McpError(ErrorCode.InternalError, `Could not resolve userId for username: ${un}`);
          }

          async function coerceFollowersAliases() {
            const sn = mergedParams.screen_name || mergedParams.username;
            const uidParam = mergedParams.user_id || mergedParams.userId;
            if (lower === 'users/followers' || lower === 'followers') {
              name = 'followersListV2';
              if (!mergedParams.userId) {
                mergedParams.userId = uidParam ? String(uidParam) : (sn ? await resolveUserId(String(sn)) : undefined);
              }
            } else if (lower === 'users/following' || lower === 'following') {
              name = 'followingsListV2';
              if (!mergedParams.userId) {
                mergedParams.userId = uidParam ? String(uidParam) : (sn ? await resolveUserId(String(sn)) : undefined);
              }
            }
          }

          await coerceFollowersAliases();

          if (usernameOnly) {
            const un = decodeURIComponent(usernameOnly[1]);
            name = 'search';
            mergedParams.words = `from:${un}`;
            if (!('topicId' in mergedParams)) mergedParams.topicId = 702;
            if (!('count' in mergedParams)) mergedParams.count = 1;
          } else if (usernameFollowing) {
            const un = decodeURIComponent(usernameFollowing[1]);
            const uid = await resolveUserId(un);
            name = 'followingsListV2';
            mergedParams.userId = uid;
          } else if (usernameFollowers) {
            const un = decodeURIComponent(usernameFollowers[1]);
            const uid = await resolveUserId(un);
            name = 'followersListV2';
            mergedParams.userId = uid;
          } else if (idFollowing) {
            name = 'followingsListV2';
            mergedParams.userId = idFollowing[1];
          } else if (idFollowers) {
            name = 'followersListV2';
            mergedParams.userId = idFollowers[1];
          } else if (lower === 'followers/list' || lower === '/followers/list' || lower === 'users/followers/list') {
            name = 'followersListV2';
            if (!mergedParams.userId) {
              const sn = mergedParams.screen_name || mergedParams.username;
              const uidParam = mergedParams.user_id || mergedParams.userId;
              mergedParams.userId = uidParam ? String(uidParam) : (sn ? await resolveUserId(String(sn)) : undefined);
            }
          } else if (lower === 'friends/list' || lower === '/friends/list' || lower === 'users/friends/list') {
            name = 'followingsListV2';
            if (!mergedParams.userId) {
              const sn = mergedParams.screen_name || mergedParams.username;
              const uidParam = mergedParams.user_id || mergedParams.userId;
              mergedParams.userId = uidParam ? String(uidParam) : (sn ? await resolveUserId(String(sn)) : undefined);
            }
          } else if (name.includes('/')) {
            throw new McpError(
              ErrorCode.InvalidRequest,
              `Unsupported endpoint path '${ep}'. Use apitools names like 'followersListV2' or 'followingsListV2'. `+
              `To resolve a username, first call 'search' with words='from:<username>' (topicId=702), then call the V2 list with userId.`
            );
          }

          return twitterAPI.callApiTools(name, mth, mergedParams, { includeAuth, apiKeyOverride, authToken, ct0 });
        }

        const res = await mapAndCall(endpoint, method, mergedParams || {});
        return { content: [{ type: 'text', text: JSON.stringify(res, null, 2) }] };
      }
      case 'twitter_communities_call':
      case 'twitter_dms_call':
      case 'twitter_follows_call':
      case 'twitter_notifications_call':
      case 'twitter_get_twees_call':
      case 'twitter_lists_call':
      case 'twitter_login_get_token_call':
      case 'twitter_search_call':
      case 'twitter_send_twees_call':
      case 'twitter_users_call': {
        const { endpoint, method, params, includeAuth, apiKeyOverride, authToken, ct0 } = CallApiToolsArgsSchema.parse(args);
        // default includeAuth for common write categories if not provided
        const needsAuth = ['twitter_dms_call','twitter_follows_call','twitter_send_twees_call'].includes(name);
        const effectiveIncludeAuth = includeAuth ?? needsAuth;
        const res = await twitterAPI.callApiTools(endpoint, method, params || {}, { includeAuth: effectiveIncludeAuth, apiKeyOverride, authToken, ct0 });
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
  console.error('Twitter MCP server running on stdio');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}
