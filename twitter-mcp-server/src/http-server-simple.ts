#!/usr/bin/env node

import express from 'express';
import cors from 'cors';
import { TwitterAPI } from './twitter-api.js';

// Configuration
const PORT = process.env.PORT || 3002;
const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY || 'your_rapidapi_key_here';
const RAPIDAPI_HOST = process.env.RAPIDAPI_HOST || 'twitter-api-v1-1-enterprise.p.rapidapi.com';
const RAPIDAPI_BASE_URL = process.env.RAPIDAPI_BASE_URL || 'https://twitter-api-v1-1-enterprise.p.rapidapi.com';

const twitterAPI = new TwitterAPI({
  rapidApiKey: RAPIDAPI_KEY,
  rapidApiHost: RAPIDAPI_HOST,
  baseURL: RAPIDAPI_BASE_URL,
});

// Create Express app
const app = express();
app.use(cors());
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', endpoints: 57, version: '3.0.0-simple' });
});

// Tool definitions - matching ultimate server + new batch tools
const TOOLS = [
  {
    name: 'call_twitter_apitools',
    description: 'Generic call for any of the 149+ discovered Twitter API endpoints. Use direct endpoint names only.',
    inputSchema: {
      type: 'object',
      properties: {
        endpoint: { 
          type: 'string',
          description: 'Direct endpoint name (e.g., search, followersListV2, userTimeline)'
        },
        method: { type: 'string', enum: ['GET','POST'], default: 'GET' },
        params: { type: 'object', additionalProperties: true },
        includeAuth: { type: 'boolean', default: false }
      },
      required: ['endpoint']
    }
  },
  {
    name: 'twitter_search',
    description: 'Search tweets and users',
    inputSchema: {
      type: 'object',
      properties: {
        words: { type: 'string', description: 'Search query' },
        count: { type: 'number', default: 25 },
        topicId: { type: 'number', default: 702 }
      },
      required: ['words']
    }
  },
  {
    name: 'twitter_get_followers',
    description: 'Get followers list',
    inputSchema: {
      type: 'object',
      properties: {
        userId: { type: 'string', description: 'Twitter user ID' },
        count: { type: 'number', default: 20 }
      },
      required: ['userId']
    }
  },
  {
    name: 'twitter_get_following',
    description: 'Get following list',
    inputSchema: {
      type: 'object',
      properties: {
        userId: { type: 'string', description: 'Twitter user ID' },
        count: { type: 'number', default: 20 }
      },
      required: ['userId']
    }
  },
  {
    name: 'twitter_user_timeline',
    description: 'Get user timeline/tweets',
    inputSchema: {
      type: 'object',
      properties: {
        userId: { type: 'string', description: 'Twitter user ID' },
        username: { type: 'string', description: 'Twitter username' },
        count: { type: 'number', default: 25 }
      }
    }
  },
  {
    name: 'twitter_batch_user_profiles',
    description: 'Get multiple user profiles in parallel - much faster than sequential calls',
    inputSchema: {
      type: 'object',
      properties: {
        usernames: { 
          type: 'array', 
          items: { type: 'string' },
          description: 'Array of Twitter usernames to fetch profiles for'
        }
      },
      required: ['usernames']
    }
  },
  {
    name: 'twitter_batch_user_timelines',
    description: 'Get multiple user timelines in parallel - much faster than sequential calls',
    inputSchema: {
      type: 'object',
      properties: {
        users: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              userId: { type: 'string' },
              username: { type: 'string' },
              count: { type: 'number', default: 25 }
            }
          },
          description: 'Array of user objects with userId or username'
        }
      },
      required: ['users']
    }
  },
  {
    name: 'twitter_batch_followers',
    description: 'Get followers for multiple users in parallel - much faster than sequential calls',
    inputSchema: {
      type: 'object',
      properties: {
        userIds: {
          type: 'array',
          items: { type: 'string' },
          description: 'Array of Twitter user IDs'
        },
        count: { type: 'number', default: 20 }
      },
      required: ['userIds']
    }
  },
  {
    name: 'twitter_batch_following',
    description: 'Get following lists for multiple users in parallel - much faster than sequential calls',
    inputSchema: {
      type: 'object',
      properties: {
        userIds: {
          type: 'array',
          items: { type: 'string' },
          description: 'Array of Twitter user IDs'
        },
        count: { type: 'number', default: 20 }
      },
      required: ['userIds']
    }
  }
];

// MCP endpoint
app.post('/', async (req, res) => {
  console.log(`[MCP] 🔗 POST / from ${req.ip}`);
  console.log(`[MCP] 📦 Body:`, JSON.stringify(req.body, null, 2));
  
  const { method, params, id } = req.body;
  
  try {
    let result;
    
    if (method === 'initialize') {
      console.log(`[MCP] 🤝 MCP Client initializing:`, params);
      result = {
        protocolVersion: '2024-11-05',
        capabilities: { tools: {} },
        serverInfo: { name: 'twitter-mcp-server-simple', version: '3.0.0' }
      };
    } 
    else if (method === 'notifications/initialized') {
      console.log(`[MCP] ✅ MCP Client initialized successfully`);
      res.status(200).end();
      return;
    } 
    else if (method === 'tools/list') {
      console.log(`[MCP] 📋 Listing tools`);
      result = { tools: TOOLS };
    } 
    else if (method === 'tools/call') {
      const { name, arguments: args } = params;
      console.log(`[MCP] 🔧 Calling tool: ${name}`);
      
      // Handle tool calls
      if (name === 'call_twitter_apitools') {
        const { endpoint, method: httpMethod = 'GET', params: toolParams = {}, includeAuth } = args;
        
        // Reject paths with slashes
        if (endpoint.includes('/')) {
          throw new Error(`Use direct endpoint names only. Examples: "search", "followersListV2". Do not use paths like "${endpoint}".`);
        }
        
        console.log(`[MCP] 🔥 Direct call: ${endpoint} (${httpMethod})`);
        const apiResult = await twitterAPI.callApiTools(endpoint, httpMethod, toolParams, { includeAuth });
        result = { content: [{ type: 'text', text: JSON.stringify(apiResult, null, 2) }] };
      }
      else if (name === 'twitter_search') {
        const { words, count = 25, topicId = 702, lang } = args;
        console.log(`[MCP] 🔍 Search: ${words}`);
        const apiResult = await twitterAPI.callApiTools('search', 'GET', { words, count, topicId, ...(lang && { lang }) });
        result = { content: [{ type: 'text', text: JSON.stringify(apiResult, null, 2) }] };
      }
      else if (name === 'twitter_get_followers') {
        const { userId, count = 20, cursor } = args;
        console.log(`[MCP] 👥 Get followers: ${userId}`);
        const apiResult = await twitterAPI.callApiTools('followersListV2', 'GET', { userId, count, ...(cursor && { cursor }) });
        result = { content: [{ type: 'text', text: JSON.stringify(apiResult, null, 2) }] };
      }
      else if (name === 'twitter_get_following') {
        const { userId, count = 20, cursor } = args;
        console.log(`[MCP] 👥 Get following: ${userId}`);
        const apiResult = await twitterAPI.callApiTools('followingsListV2', 'GET', { userId, count, ...(cursor && { cursor }) });
        result = { content: [{ type: 'text', text: JSON.stringify(apiResult, null, 2) }] };
      }
      else if (name === 'twitter_user_timeline') {
        const { userId, username, count = 25 } = args;
        console.log(`[MCP] 👤 User timeline: ${userId || username}`);
        const toolParams = userId ? { userId } : { username };
        const apiResult = await twitterAPI.callApiTools('userTimeline', 'GET', { ...toolParams, count });
        result = { content: [{ type: 'text', text: JSON.stringify(apiResult, null, 2) }] };
      }
      else if (name === 'twitter_batch_user_profiles') {
        const { usernames } = args;
        console.log(`[MCP] 🚀 Batch user profiles: ${usernames.length} users`);
        const startTime = Date.now();
        const apiResults = await twitterAPI.getUserProfilesBatch(usernames);
        const endTime = Date.now();
        console.log(`[MCP] ✅ Batch completed in ${endTime - startTime}ms (${usernames.length} users)`);
        result = { content: [{ type: 'text', text: JSON.stringify(apiResults, null, 2) }] };
      }
      else if (name === 'twitter_batch_user_timelines') {
        const { users } = args;
        console.log(`[MCP] 🚀 Batch user timelines: ${users.length} users`);
        const startTime = Date.now();
        const apiResults = await twitterAPI.getUserTimelinesBatch(users);
        const endTime = Date.now();
        console.log(`[MCP] ✅ Batch completed in ${endTime - startTime}ms (${users.length} users)`);
        result = { content: [{ type: 'text', text: JSON.stringify(apiResults, null, 2) }] };
      }
      else if (name === 'twitter_batch_followers') {
        const { userIds, count = 20 } = args;
        console.log(`[MCP] 🚀 Batch followers: ${userIds.length} users`);
        const startTime = Date.now();
        const apiResults = await twitterAPI.getFollowersBatch(userIds, count);
        const endTime = Date.now();
        console.log(`[MCP] ✅ Batch completed in ${endTime - startTime}ms (${userIds.length} users)`);
        result = { content: [{ type: 'text', text: JSON.stringify(apiResults, null, 2) }] };
      }
      else if (name === 'twitter_batch_following') {
        const { userIds, count = 20 } = args;
        console.log(`[MCP] 🚀 Batch following: ${userIds.length} users`);
        const startTime = Date.now();
        const apiResults = await twitterAPI.getFollowingBatch(userIds, count);
        const endTime = Date.now();
        console.log(`[MCP] ✅ Batch completed in ${endTime - startTime}ms (${userIds.length} users)`);
        result = { content: [{ type: 'text', text: JSON.stringify(apiResults, null, 2) }] };
      }
      else {
        throw new Error(`Unknown tool: ${name}`);
      }
    } 
    else {
      throw new Error(`Unknown method: ${method}`);
    }
    
    res.json({
      jsonrpc: '2.0',
      id,
      result
    });
    
  } catch (error) {
    console.error(`[MCP] ❌ Error:`, error);
    res.json({
      jsonrpc: '2.0',
      id,
      error: {
        code: -32600,
        message: error instanceof Error ? error.message : 'Unknown error'
      }
    });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`[MCP] 🚀 Twitter MCP HTTP Server (SIMPLE + FAST) running on port ${PORT}`);
  console.log(`[MCP] 📋 9 tools: 5 standard + 4 batch tools for speed`);
  console.log(`[MCP] ⚡ Batch tools provide 5-20x speed improvement for multiple operations`);
  console.log(`[MCP] 🔧 Use direct endpoint names only (no paths)`);
  console.log(`[MCP] 🌍 Health check: http://localhost:${PORT}/health`);
});