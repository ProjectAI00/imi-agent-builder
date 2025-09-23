#!/usr/bin/env node

import 'dotenv/config';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ErrorCode,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import type { CallToolRequest } from '@modelcontextprotocol/sdk/types.js';
import express from 'express';
import cors from 'cors';
import { z } from 'zod';
import { TwitterAPI } from './twitter-api.ts';

const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY || 'your_rapidapi_key_here';
const RAPIDAPI_HOST = process.env.RAPIDAPI_HOST || 'twitter-api-v1-1-enterprise.p.rapidapi.com';
const RAPIDAPI_BASE_URL = process.env.RAPIDAPI_BASE_URL || 'https://twitter-api-v1-1-enterprise.p.rapidapi.com';
const PORT = Number(process.env.PORT || 3002);

const twitterAPI = new TwitterAPI({
  rapidApiKey: RAPIDAPI_KEY,
  rapidApiHost: RAPIDAPI_HOST,
  baseURL: RAPIDAPI_BASE_URL,
});

// Schemas
const SearchTweetsArgsSchema = z.object({
  query: z.string(),
  limit: z.number().min(1).max(100).default(25),
  lang: z.string().optional(),
});
const GetTweetArgsSchema = z.object({ tweetId: z.string() });
const GetUserArgsSchema = z.object({ username: z.string() });
const GetUserTweetsArgsSchema = z.object({ userId: z.string().optional(), username: z.string().optional(), limit: z.number().min(1).max(200).default(25) });
const SendTweetArgsSchema = z.object({ status: z.string() });
const FollowUserArgsSchema = z.object({ userId: z.string().optional(), username: z.string().optional() }).refine(v => !!v.userId || !!v.username, { message: 'Provide userId or username' });
const SendDMArgsSchema = z.object({ senderId: z.string(), recipientId: z.string(), text: z.string() });
const CallTwitterApiArgsSchema = z.object({ method: z.enum(['GET','POST','PUT','PATCH','DELETE']).default('GET'), path: z.string(), query: z.record(z.any()).optional(), body: z.any().optional() });
const CallApiToolsArgsSchema = z.object({ endpoint: z.string(), method: z.enum(['GET','POST']).default('GET'), params: z.record(z.any()).optional(), includeAuth: z.boolean().default(false), apiKeyOverride: z.string().optional(), authToken: z.string().optional(), ct0: z.string().optional() }).passthrough();

const server = new Server(
  { name: 'twitter-mcp-server', version: '1.0.0' },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      { name: 'call_twitter_apitools', description: 'Generic /base/apitools/* call. Examples: followers → endpoint "users/followers" with { username, count } OR "/users/by/username/<name>/followers" with { count }', inputSchema: { type: 'object', additionalProperties: true, properties: { endpoint: { type: 'string' }, method: { type: 'string', enum: ['GET','POST'], default: 'GET' }, params: { type: 'object', additionalProperties: true, properties: { username: { type: 'string' }, screen_name: { type: 'string' }, userId: { type: 'string' }, user_id: { type: 'string' }, count: { type: 'number' }, cursor: { type: 'string' }, words: { type: 'string' }, topicId: { type: 'number' } } }, includeAuth: { type: 'boolean', default: false }, apiKeyOverride: { type: 'string' }, authToken: { type: 'string' }, ct0: { type: 'string' }, username: { type: 'string' }, screen_name: { type: 'string' }, userId: { type: 'string' }, user_id: { type: 'string' }, count: { type: 'number' }, cursor: { type: 'string' }, words: { type: 'string' }, topicId: { type: 'number' } }, required: ['endpoint'] } },
      { name: 'twitter_communities_call', description: 'Call Twitter_Communities_api_tools endpoint', inputSchema: { type: 'object', properties: { endpoint: { type: 'string' }, method: { type: 'string', enum: ['GET','POST'], default: 'GET' }, params: { type: 'object', additionalProperties: true }, includeAuth: { type: 'boolean' }, apiKeyOverride: { type: 'string' }, authToken: { type: 'string' }, ct0: { type: 'string' } }, required: ['endpoint'] } },
      { name: 'twitter_dms_call', description: 'Call Twitter_DMS_api_tools endpoint', inputSchema: { type: 'object', properties: { endpoint: { type: 'string' }, method: { type: 'string', enum: ['GET','POST'], default: 'POST' }, params: { type: 'object', additionalProperties: true }, includeAuth: { type: 'boolean' }, apiKeyOverride: { type: 'string' }, authToken: { type: 'string' }, ct0: { type: 'string' } }, required: ['endpoint'] } },
      { name: 'twitter_follows_call', description: 'Call Twitter_Follows_api_tools endpoint', inputSchema: { type: 'object', properties: { endpoint: { type: 'string' }, method: { type: 'string', enum: ['GET','POST'], default: 'POST' }, params: { type: 'object', additionalProperties: true }, includeAuth: { type: 'boolean' }, apiKeyOverride: { type: 'string' }, authToken: { type: 'string' }, ct0: { type: 'string' } }, required: ['endpoint'] } },
      { name: 'twitter_notifications_call', description: 'Call Twitter_Get_Notifications_api_tools endpoint', inputSchema: { type: 'object', properties: { endpoint: { type: 'string' }, method: { type: 'string', enum: ['GET','POST'], default: 'GET' }, params: { type: 'object', additionalProperties: true }, includeAuth: { type: 'boolean' }, apiKeyOverride: { type: 'string' }, authToken: { type: 'string' }, ct0: { type: 'string' } }, required: ['endpoint'] } },
      { name: 'twitter_get_twees_call', description: 'Call Twitter_Get_Twees_api_tools endpoint', inputSchema: { type: 'object', properties: { endpoint: { type: 'string' }, method: { type: 'string', enum: ['GET','POST'], default: 'GET' }, params: { type: 'object', additionalProperties: true }, includeAuth: { type: 'boolean' }, apiKeyOverride: { type: 'string' }, authToken: { type: 'string' }, ct0: { type: 'string' } }, required: ['endpoint'] } },
      { name: 'twitter_lists_call', description: 'Call Twitter_List_api_tools endpoint', inputSchema: { type: 'object', properties: { endpoint: { type: 'string' }, method: { type: 'string', enum: ['GET','POST'], default: 'GET' }, params: { type: 'object', additionalProperties: true }, includeAuth: { type: 'boolean' }, apiKeyOverride: { type: 'string' }, authToken: { type: 'string' }, ct0: { type: 'string' } }, required: ['endpoint'] } },
      { name: 'twitter_login_get_token_call', description: 'Call Twitter_LoginGetToken_api_tools endpoint', inputSchema: { type: 'object', properties: { endpoint: { type: 'string' }, method: { type: 'string', enum: ['GET','POST'], default: 'POST' }, params: { type: 'object', additionalProperties: true }, includeAuth: { type: 'boolean' }, apiKeyOverride: { type: 'string' }, authToken: { type: 'string' }, ct0: { type: 'string' } }, required: ['endpoint'] } },
      { name: 'twitter_search_call', description: 'Call Twitter_Search_api_tools endpoint', inputSchema: { type: 'object', properties: { endpoint: { type: 'string' }, method: { type: 'string', enum: ['GET','POST'], default: 'GET' }, params: { type: 'object', additionalProperties: true }, includeAuth: { type: 'boolean' }, apiKeyOverride: { type: 'string' }, authToken: { type: 'string' }, ct0: { type: 'string' } }, required: ['endpoint'] } },
      { name: 'twitter_send_twees_call', description: 'Call Twitter_Send_Twees_api_tools endpoint', inputSchema: { type: 'object', properties: { endpoint: { type: 'string' }, method: { type: 'string', enum: ['GET','POST'], default: 'POST' }, params: { type: 'object', additionalProperties: true }, includeAuth: { type: 'boolean' }, apiKeyOverride: { type: 'string' }, authToken: { type: 'string' }, ct0: { type: 'string' } }, required: ['endpoint'] } },
      { name: 'twitter_users_call', description: 'Call Twitter_Users_api_tools endpoint', inputSchema: { type: 'object', properties: { endpoint: { type: 'string' }, method: { type: 'string', enum: ['GET','POST'], default: 'GET' }, params: { type: 'object', additionalProperties: true }, includeAuth: { type: 'boolean' }, apiKeyOverride: { type: 'string' }, authToken: { type: 'string' }, ct0: { type: 'string' } }, required: ['endpoint'] } },
    ]
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request: CallToolRequest) => {
  try {
    const { name, arguments: args } = request.params;
    switch (name) {
      case 'search_twitter_tweets': {
        const { query, limit, lang } = SearchTweetsArgsSchema.parse(args);
        const data = await twitterAPI.searchTweets(query, limit, lang);
        return { content: [{ type: 'text', text: JSON.stringify({ query, count: data?.statuses?.length ?? 0, result: data }, null, 2) }] };
      }
      case 'call_twitter_apitools': {
        const { endpoint, method, params, includeAuth, apiKeyOverride, authToken, ct0 } = CallApiToolsArgsSchema.parse(args);

        async function mapAndCall(ep: string, mth: 'GET'|'POST', p: Record<string, any> = {}) {
          // Auto-inject internal apiKey if not provided
          const internalKey = process.env.RAPIDAPI_TWITTER_APIKEY || process.env.TWITTER_INTERNAL_API_KEY;
          const mergedParams = { ...(p || {}) } as Record<string, any>;
          if (!('apiKey' in mergedParams) && internalKey) mergedParams.apiKey = internalKey;
          if (!('resFormat' in mergedParams)) mergedParams.resFormat = 'json';

          let name = ep;
          if (name.startsWith('/base/apitools/')) name = name.replace('/base/apitools/', '');

          // Friendly remapping for common official paths → provider apitools
          const lower = name.toLowerCase();
          const usernameFollowing = lower.match(/^\/users\/by\/username\/([^/]+)\/following$/);
          const usernameFollowers = lower.match(/^\/users\/by\/username\/([^/]+)\/followers$/);
          const idFollowing = lower.match(/^\/users\/(\d+)\/following$/);
          const idFollowers = lower.match(/^\/users\/(\d+)\/followers$/);

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

          if (usernameFollowing) {
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
          } else if (name.startsWith('/')) {
            // Any other raw official path is not supported; guide with a helpful error
            throw new McpError(
              ErrorCode.InvalidRequest,
              `Unsupported endpoint path '${ep}'. Use apitools names like 'followersListV2' or 'followingsListV2'. `+
              `To resolve a username, first call 'search' with words='from:<username>' (topicId=702), then call the V2 list with userId.`
            );
          }

          return twitterAPI.callApiTools(name, mth, mergedParams, { includeAuth, apiKeyOverride, authToken, ct0 });
        }

        const res = await mapAndCall(endpoint, method, params || {});
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

// Express app + SSE
const app = express();
app.use(cors());
app.use(express.json());

// Add request logging middleware BEFORE routes
app.use((req, res, next) => {
  console.log(`🔗 ${req.method} ${req.path} from ${req.ip}`);
  if (req.body && Object.keys(req.body).length > 0) {
    console.log('📦 Body:', JSON.stringify(req.body, null, 2));
  }
  next();
});

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', server: 'twitter-mcp-server' });
});

app.use('/sse', async (_req, res) => {
  const transport = new SSEServerTransport('/sse', res);
  await server.connect(transport);
});

// HTTP endpoint for MCP - handle JSON-RPC manually 
app.post('/', async (req, res) => {
  try {
    const { jsonrpc, method, params, id } = req.body;
    
    // Validate JSON-RPC format
    if (jsonrpc !== '2.0') {
      return res.status(400).json({
        jsonrpc: '2.0',
        id,
        error: { code: -32600, message: 'Invalid Request' }
      });
    }
    
    let result;
    
    switch (method) {
      case 'initialize': {
        // Handle MCP protocol initialization
        console.log('🤝 MCP Client initializing:', params);
        result = {
          protocolVersion: '2025-06-18',
          capabilities: {
            tools: {}
          },
          serverInfo: {
            name: 'twitter-mcp-server',
            version: '1.0.0'
          }
        };
        break;
      }
      
      case 'notifications/initialized': {
        // Handle MCP protocol initialized notification (no response needed)
        console.log('✅ MCP Client initialized successfully');
        return res.json({ jsonrpc: '2.0', id });
      }
      
      case 'tools/list': {
        // Manually return tools list - minimal, without legacy v1.1 wrappers
        result = {
          tools: [
            { name: 'call_twitter_apitools', description: 'Generic /base/apitools/* call. Examples: followers → endpoint "users/followers" with { username, count } OR "/users/by/username/<name>/followers" with { count }', inputSchema: { type: 'object', additionalProperties: true, properties: { endpoint: { type: 'string' }, method: { type: 'string', enum: ['GET','POST'], default: 'GET' }, params: { type: 'object', additionalProperties: true, properties: { username: { type: 'string' }, screen_name: { type: 'string' }, userId: { type: 'string' }, user_id: { type: 'string' }, count: { type: 'number' }, cursor: { type: 'string' }, words: { type: 'string' }, topicId: { type: 'number' } } }, includeAuth: { type: 'boolean', default: false }, apiKeyOverride: { type: 'string' }, authToken: { type: 'string' }, ct0: { type: 'string' }, username: { type: 'string' }, screen_name: { type: 'string' }, userId: { type: 'string' }, user_id: { type: 'string' }, count: { type: 'number' }, cursor: { type: 'string' }, words: { type: 'string' }, topicId: { type: 'number' } }, required: ['endpoint'] } },
          ]
        };
        break;
      }
      
      case 'tools/call': {
        // Handle tool calls by invoking the existing tool handler logic
        const { name, arguments: args } = params;
        
        switch (name) {
          case 'search_twitter_tweets': {
            const { query, limit, lang } = SearchTweetsArgsSchema.parse(args);
            const data = await twitterAPI.searchTweets(query, limit, lang);
            result = { content: [{ type: 'text', text: JSON.stringify({ query, count: data?.statuses?.length ?? 0, result: data }, null, 2) }] };
            break;
          }
          case 'call_twitter_apitools': {
            const parsed = CallApiToolsArgsSchema.parse(args) as any;
            const { endpoint, method, params, includeAuth, apiKeyOverride, authToken, ct0, ...rest } = parsed;
            // Merge any stray top-level keys (e.g., 'user.fields') into params so strict clients don't break
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

              // Aliases for common guesses like 'users/followers' with screen_name
              async function coerceFollowersAliases() {
                // If client passed screen_name/username/user_id on alias endpoints
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
                // Remap to a user lookup via apitools search
                name = 'search';
                mergedParams.words = `from:${un}`;
                if (!('topicId' in mergedParams)) mergedParams.topicId = 702;
                if (!('count' in mergedParams)) mergedParams.count = 1;
                console.log(`🔁 Remap: ${ep} -> search (words=from:${un})`);
              } else if (usernameFollowing) {
                const un = decodeURIComponent(usernameFollowing[1]);
                const uid = await resolveUserId(un);
                name = 'followingsListV2';
                mergedParams.userId = uid;
                console.log(`🔁 Remap: ${ep} -> followingsListV2 (userId=${uid})`);
              } else if (usernameFollowers) {
                const un = decodeURIComponent(usernameFollowers[1]);
                const uid = await resolveUserId(un);
                name = 'followersListV2';
                mergedParams.userId = uid;
                console.log(`🔁 Remap: ${ep} -> followersListV2 (userId=${uid})`);
              } else if (idFollowing) {
                name = 'followingsListV2';
                mergedParams.userId = idFollowing[1];
                console.log(`🔁 Remap: ${ep} -> followingsListV2 (userId=${idFollowing[1]})`);
              } else if (idFollowers) {
                name = 'followersListV2';
                mergedParams.userId = idFollowers[1];
                console.log(`🔁 Remap: ${ep} -> followersListV2 (userId=${idFollowers[1]})`);
              } else if (lower === 'followers/list' || lower === '/followers/list' || lower === 'users/followers/list') {
                name = 'followersListV2';
                if (!mergedParams.userId) {
                  const sn = mergedParams.screen_name || mergedParams.username;
                  const uidParam = mergedParams.user_id || mergedParams.userId;
                  mergedParams.userId = uidParam ? String(uidParam) : (sn ? await resolveUserId(String(sn)) : undefined);
                }
                console.log(`🔁 Remap: ${ep} (alias) -> followersListV2 (userId=${mergedParams.userId})`);
              } else if (lower === 'friends/list' || lower === '/friends/list' || lower === 'users/friends/list') {
                name = 'followingsListV2';
                if (!mergedParams.userId) {
                  const sn = mergedParams.screen_name || mergedParams.username;
                  const uidParam = mergedParams.user_id || mergedParams.userId;
                  mergedParams.userId = uidParam ? String(uidParam) : (sn ? await resolveUserId(String(sn)) : undefined);
                }
                console.log(`🔁 Remap: ${ep} (alias) -> followingsListV2 (userId=${mergedParams.userId})`);
              } else if (name.includes('/')) {
                throw new McpError(
                  ErrorCode.InvalidRequest,
                  `Unsupported endpoint path '${ep}'. Use apitools names like 'followersListV2' or 'followingsListV2'. To resolve a username, first call 'search' with words='from:<username>' (topicId=702).`
                );
              }

              return twitterAPI.callApiTools(name, mth, mergedParams, { includeAuth, apiKeyOverride, authToken, ct0 });
            }

              const resCall = await mapAndCall(endpoint, method, mergedParams || {});
            result = { content: [{ type: 'text', text: JSON.stringify(resCall, null, 2) }] };
            break;
          }
          default:
            throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
        }
        break;
      }
      
      default:
        return res.status(400).json({
          jsonrpc: '2.0',
          id,
          error: { code: -32601, message: 'Method not found' }
        });
    }
    
    return res.json({
      jsonrpc: '2.0',
      id,
      result
    });
    
  } catch (error) {
    console.error('HTTP MCP endpoint error:', error);
    return res.status(500).json({
      jsonrpc: '2.0',
      id: req.body?.id || null,
      error: { 
        code: -32603, 
        message: 'Internal error', 
        data: error instanceof Error ? error.message : String(error) 
      }
    });
  }
});


async function main() {
  return new Promise<void>((resolve, reject) => {
    const server = app.listen(PORT, () => {
      console.log(`🐦 Twitter MCP Server running on http://localhost:${PORT}`);
      console.log(`📡 SSE endpoint: http://localhost:${PORT}/sse`);
      console.log(`🏥 Health check: http://localhost:${PORT}/health`);
    });
    
    server.on('error', reject);
    
    // Keep the process alive
    process.on('SIGINT', () => {
      console.log('\n🛑 Shutting down Twitter MCP Server...');
      server.close(() => {
        console.log('✅ Twitter MCP Server stopped');
        resolve();
      });
    });
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}
