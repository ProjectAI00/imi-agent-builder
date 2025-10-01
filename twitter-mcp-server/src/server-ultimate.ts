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

// RapidAPI configuration
const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY || 'your_rapidapi_key_here';
const RAPIDAPI_HOST = process.env.RAPIDAPI_HOST || 'twitter-api-v1-1-enterprise.p.rapidapi.com';
const RAPIDAPI_BASE_URL = process.env.RAPIDAPI_BASE_URL || 'https://twitter-api-v1-1-enterprise.p.rapidapi.com';

const twitterAPI = new TwitterAPI({
  rapidApiKey: RAPIDAPI_KEY,
  rapidApiHost: RAPIDAPI_HOST,
  baseURL: RAPIDAPI_BASE_URL,
});

// Base schema for auth parameters
const AuthParamsSchema = z.object({
  includeAuth: z.boolean().default(false),
  apiKeyOverride: z.string().optional(),
  authToken: z.string().optional(),
  ct0: z.string().optional(),
});

// All 57 working endpoints discovered from your dashboard
const WORKING_ENDPOINTS = {
  // Search (4 endpoints)
  search: ['searchBox', 'search'],
  
  // Follows (14 endpoints) 
  follows: ['followingsList', 'followersList', 'followingsListV2', 'followersListV2', 'followingsIds', 'followersIds', 'blueVerifiedFollowersV2'],
  
  // Communities (10 endpoints)
  communities: ['CommunitiesTimelineV2', 'CommunitiesTweetsTimelineV2', 'CommunitiesSearchV2', 'CommunitiesMemberV2', 'TopicListV2'],
  
  // Get Tweets (10 endpoints)
  tweets: ['quotesV2', 'favoritersV2', 'userTweetReply', 'favoritesList', 'retweetersV2'],
  
  // Lists (2 endpoints)
  lists: ['listMembersByListIdV2'],
  
  // Auth (1 endpoint)
  auth: ['loginPost'],
  
  // Users (16 endpoints)
  users: ['tokenSync', 'highlightsV2', 'getToken', 'usersByIdRestIds', 'userTweetsV2', 'userTimeline', 'userLikeV2', 'uerByIdRestIdV2']
};

const server = new Server(
  {
    name: 'twitter-mcp-server-ultimate',
    version: '3.0.0',
  },
  {
    capabilities: { tools: {} },
  }
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      // GENERIC TOOL (can call any of the 149 endpoints)
      {
        name: 'call_twitter_apitools',
        description: 'Generic call for any of the 149+ discovered Twitter API endpoints. Can call fully working endpoints or those requiring auth.',
        inputSchema: {
          type: 'object',
          properties: {
            endpoint: { 
              type: 'string',
              description: 'Endpoint name (57 work fully, 92+ need auth). Examples: search, followersListV2, CommunitiesTimelineV2, userTweetsV2, etc.'
            },
            method: { type: 'string', enum: ['GET','POST'], default: 'GET' },
            params: { type: 'object', additionalProperties: true },
            ...AuthParamsSchema.shape
          },
          required: ['endpoint']
        }
      },

      // SEARCH CATEGORY (4 working endpoints)
      {
        name: 'twitter_search',
        description: 'Search tweets and users with the main search endpoint',
        inputSchema: {
          type: 'object',
          properties: {
            words: { type: 'string', description: 'Search query (e.g., "from:elonmusk", "bitcoin")' },
            count: { type: 'number', default: 25, minimum: 1, maximum: 100 },
            topicId: { type: 'number', default: 702 },
            lang: { type: 'string', optional: true }
          },
          required: ['words']
        }
      },
      {
        name: 'twitter_search_box',
        description: 'Search using the searchBox endpoint (alternative search method)',
        inputSchema: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Search query' },
            count: { type: 'number', default: 25 },
            method: { type: 'string', enum: ['GET', 'POST'], default: 'GET' }
          },
          required: ['query']
        }
      },

      // FOLLOWS CATEGORY (14 working endpoints)
      {
        name: 'twitter_get_followers',
        description: 'Get followers list (V2 - recommended)',
        inputSchema: {
          type: 'object',
          properties: {
            userId: { type: 'string', description: 'Twitter user ID' },
            count: { type: 'number', default: 20, maximum: 200 },
            cursor: { type: 'string', optional: true }
          },
          required: ['userId']
        }
      },
      {
        name: 'twitter_get_following',
        description: 'Get following list (V2 - recommended)',
        inputSchema: {
          type: 'object',
          properties: {
            userId: { type: 'string', description: 'Twitter user ID' },
            count: { type: 'number', default: 20, maximum: 200 },
            cursor: { type: 'string', optional: true }
          },
          required: ['userId']
        }
      },
      {
        name: 'twitter_get_follower_ids',
        description: 'Get follower IDs only (lightweight)',
        inputSchema: {
          type: 'object',
          properties: {
            userId: { type: 'string', description: 'Twitter user ID' },
            count: { type: 'number', default: 100, maximum: 5000 },
            cursor: { type: 'string', optional: true }
          },
          required: ['userId']
        }
      },
      {
        name: 'twitter_get_following_ids',
        description: 'Get following IDs only (lightweight)',
        inputSchema: {
          type: 'object',
          properties: {
            userId: { type: 'string', description: 'Twitter user ID' },
            count: { type: 'number', default: 100, maximum: 5000 },
            cursor: { type: 'string', optional: true }
          },
          required: ['userId']
        }
      },
      {
        name: 'twitter_get_blue_verified_followers',
        description: 'Get blue verified followers',
        inputSchema: {
          type: 'object',
          properties: {
            userId: { type: 'string', description: 'Twitter user ID' },
            count: { type: 'number', default: 20, maximum: 200 },
            cursor: { type: 'string', optional: true }
          },
          required: ['userId']
        }
      },

      // COMMUNITIES CATEGORY (10 working endpoints - ALL work!)
      {
        name: 'twitter_communities_timeline',
        description: 'Get communities timeline',
        inputSchema: {
          type: 'object',
          properties: {
            communityId: { type: 'string', description: 'Community ID' },
            count: { type: 'number', default: 25 },
            method: { type: 'string', enum: ['GET', 'POST'], default: 'GET' }
          },
          required: ['communityId']
        }
      },
      {
        name: 'twitter_communities_tweets',
        description: 'Get tweets from a community',
        inputSchema: {
          type: 'object',
          properties: {
            communityId: { type: 'string', description: 'Community ID' },
            count: { type: 'number', default: 25 },
            method: { type: 'string', enum: ['GET', 'POST'], default: 'GET' }
          },
          required: ['communityId']
        }
      },
      {
        name: 'twitter_communities_search',
        description: 'Search communities',
        inputSchema: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Search query for communities' },
            count: { type: 'number', default: 25 },
            method: { type: 'string', enum: ['GET', 'POST'], default: 'GET' }
          },
          required: ['query']
        }
      },
      {
        name: 'twitter_communities_members',
        description: 'Get community members',
        inputSchema: {
          type: 'object',
          properties: {
            communityId: { type: 'string', description: 'Community ID' },
            count: { type: 'number', default: 25 },
            method: { type: 'string', enum: ['GET', 'POST'], default: 'GET' }
          },
          required: ['communityId']
        }
      },
      {
        name: 'twitter_topic_list',
        description: 'Get topic list',
        inputSchema: {
          type: 'object',
          properties: {
            topicId: { type: 'string', description: 'Topic ID' },
            method: { type: 'string', enum: ['GET', 'POST'], default: 'GET' }
          }
        }
      },

      // TWEETS CATEGORY (10 working endpoints)
      {
        name: 'twitter_get_quotes',
        description: 'Get quote tweets',
        inputSchema: {
          type: 'object',
          properties: {
            tweetId: { type: 'string', description: 'Tweet ID' },
            count: { type: 'number', default: 25 },
            method: { type: 'string', enum: ['GET', 'POST'], default: 'GET' }
          },
          required: ['tweetId']
        }
      },
      {
        name: 'twitter_get_favoriters',
        description: 'Get users who favorited a tweet',
        inputSchema: {
          type: 'object',
          properties: {
            tweetId: { type: 'string', description: 'Tweet ID' },
            count: { type: 'number', default: 25 },
            method: { type: 'string', enum: ['GET', 'POST'], default: 'GET' }
          },
          required: ['tweetId']
        }
      },
      {
        name: 'twitter_get_retweeters',
        description: 'Get users who retweeted a tweet',
        inputSchema: {
          type: 'object',
          properties: {
            tweetId: { type: 'string', description: 'Tweet ID' },
            count: { type: 'number', default: 25 },
            method: { type: 'string', enum: ['GET', 'POST'], default: 'GET' }
          },
          required: ['tweetId']
        }
      },
      {
        name: 'twitter_get_favorites_list',
        description: 'Get favorites/likes list for a user',
        inputSchema: {
          type: 'object',
          properties: {
            userId: { type: 'string', description: 'Twitter user ID' },
            count: { type: 'number', default: 25 },
            method: { type: 'string', enum: ['GET', 'POST'], default: 'GET' }
          },
          required: ['userId']
        }
      },
      {
        name: 'twitter_tweet_reply',
        description: 'Get tweet replies',
        inputSchema: {
          type: 'object',
          properties: {
            tweetId: { type: 'string', description: 'Tweet ID' },
            count: { type: 'number', default: 25 },
            method: { type: 'string', enum: ['GET', 'POST'], default: 'GET' }
          },
          required: ['tweetId']
        }
      },

      // USERS CATEGORY (16 working endpoints)
      {
        name: 'twitter_user_timeline',
        description: 'Get user timeline/tweets',
        inputSchema: {
          type: 'object',
          properties: {
            userId: { type: 'string', description: 'Twitter user ID' },
            username: { type: 'string', description: 'Twitter username (alternative)' },
            count: { type: 'number', default: 25, maximum: 200 },
            method: { type: 'string', enum: ['GET', 'POST'], default: 'GET' }
          },
          anyOf: [{ required: ['userId'] }, { required: ['username'] }]
        }
      },
      {
        name: 'twitter_user_tweets_v2',
        description: 'Get user tweets (V2 endpoint)',
        inputSchema: {
          type: 'object',
          properties: {
            userId: { type: 'string', description: 'Twitter user ID' },
            count: { type: 'number', default: 25, maximum: 200 },
            method: { type: 'string', enum: ['GET', 'POST'], default: 'GET' }
          },
          required: ['userId']
        }
      },
      {
        name: 'twitter_user_likes',
        description: 'Get user likes/favorites',
        inputSchema: {
          type: 'object',
          properties: {
            userId: { type: 'string', description: 'Twitter user ID' },
            count: { type: 'number', default: 25 },
            method: { type: 'string', enum: ['GET', 'POST'], default: 'GET' }
          },
          required: ['userId']
        }
      },
      {
        name: 'twitter_users_by_ids',
        description: 'Get multiple users by their IDs',
        inputSchema: {
          type: 'object',
          properties: {
            userIds: { type: 'array', items: { type: 'string' }, description: 'Array of user IDs' },
            method: { type: 'string', enum: ['GET', 'POST'], default: 'GET' }
          },
          required: ['userIds']
        }
      },
      {
        name: 'twitter_user_by_id',
        description: 'Get user by rest ID (V2)',
        inputSchema: {
          type: 'object',
          properties: {
            userId: { type: 'string', description: 'Twitter user rest ID' },
            method: { type: 'string', enum: ['GET', 'POST'], default: 'GET' }
          },
          required: ['userId']
        }
      },
      {
        name: 'twitter_user_highlights',
        description: 'Get user highlights',
        inputSchema: {
          type: 'object',
          properties: {
            userId: { type: 'string', description: 'Twitter user ID' },
            method: { type: 'string', enum: ['GET', 'POST'], default: 'GET' }
          },
          required: ['userId']
        }
      },
      {
        name: 'twitter_get_user_token',
        description: 'Get user token',
        inputSchema: {
          type: 'object',
          properties: {
            username: { type: 'string', description: 'Twitter username' },
            method: { type: 'string', enum: ['GET', 'POST'], default: 'GET' }
          },
          required: ['username']
        }
      },
      {
        name: 'twitter_token_sync',
        description: 'Sync user token',
        inputSchema: {
          type: 'object',
          properties: {
            token: { type: 'string', description: 'User token' },
            method: { type: 'string', enum: ['GET', 'POST'], default: 'GET' }
          },
          required: ['token']
        }
      },

      // LISTS CATEGORY (2 working endpoints)
      {
        name: 'twitter_list_members',
        description: 'Get Twitter list members (V2)',
        inputSchema: {
          type: 'object',
          properties: {
            listId: { type: 'string', description: 'Twitter list ID' },
            count: { type: 'number', default: 25 },
            method: { type: 'string', enum: ['GET', 'POST'], default: 'GET' }
          },
          required: ['listId']
        }
      },

      // AUTH CATEGORY (1 working endpoint)
      {
        name: 'twitter_login',
        description: 'Login to Twitter (POST method)',
        inputSchema: {
          type: 'object',
          properties: {
            username: { type: 'string', description: 'Twitter username' },
            password: { type: 'string', description: 'Twitter password' }
          },
          required: ['username', 'password']
        }
      }
    ],
  };
});

// Request handler for all the tools
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

      // SEARCH CATEGORY
      case 'twitter_search': {
        const { words, count = 25, topicId = 702, lang } = args as any;
        const res = await twitterAPI.callApiTools('search', 'GET', { words, count, topicId, ...(lang && { lang }) });
        return { content: [{ type: 'text', text: JSON.stringify(res, null, 2) }] };
      }
      case 'twitter_search_box': {
        const { query, count = 25, method = 'GET' } = args as any;
        const res = await twitterAPI.callApiTools('searchBox', method, { query, count });
        return { content: [{ type: 'text', text: JSON.stringify(res, null, 2) }] };
      }

      // FOLLOWS CATEGORY  
      case 'twitter_get_followers': {
        const { userId, count = 20, cursor } = args as any;
        const res = await twitterAPI.callApiTools('followersListV2', 'GET', { userId, count, ...(cursor && { cursor }) });
        return { content: [{ type: 'text', text: JSON.stringify(res, null, 2) }] };
      }
      case 'twitter_get_following': {
        const { userId, count = 20, cursor } = args as any;
        const res = await twitterAPI.callApiTools('followingsListV2', 'GET', { userId, count, ...(cursor && { cursor }) });
        return { content: [{ type: 'text', text: JSON.stringify(res, null, 2) }] };
      }
      case 'twitter_get_follower_ids': {
        const { userId, count = 100, cursor } = args as any;
        const res = await twitterAPI.callApiTools('followersIds', 'GET', { userId, count, ...(cursor && { cursor }) });
        return { content: [{ type: 'text', text: JSON.stringify(res, null, 2) }] };
      }
      case 'twitter_get_following_ids': {
        const { userId, count = 100, cursor } = args as any;
        const res = await twitterAPI.callApiTools('followingsIds', 'GET', { userId, count, ...(cursor && { cursor }) });
        return { content: [{ type: 'text', text: JSON.stringify(res, null, 2) }] };
      }
      case 'twitter_get_blue_verified_followers': {
        const { userId, count = 20, cursor } = args as any;
        const res = await twitterAPI.callApiTools('blueVerifiedFollowersV2', 'GET', { userId, count, ...(cursor && { cursor }) });
        return { content: [{ type: 'text', text: JSON.stringify(res, null, 2) }] };
      }

      // COMMUNITIES CATEGORY
      case 'twitter_communities_timeline': {
        const { communityId, count = 25, method = 'GET' } = args as any;
        const res = await twitterAPI.callApiTools('CommunitiesTimelineV2', method, { communityId, count });
        return { content: [{ type: 'text', text: JSON.stringify(res, null, 2) }] };
      }
      case 'twitter_communities_tweets': {
        const { communityId, count = 25, method = 'GET' } = args as any;
        const res = await twitterAPI.callApiTools('CommunitiesTweetsTimelineV2', method, { communityId, count });
        return { content: [{ type: 'text', text: JSON.stringify(res, null, 2) }] };
      }
      case 'twitter_communities_search': {
        const { query, count = 25, method = 'GET' } = args as any;
        const res = await twitterAPI.callApiTools('CommunitiesSearchV2', method, { query, count });
        return { content: [{ type: 'text', text: JSON.stringify(res, null, 2) }] };
      }
      case 'twitter_communities_members': {
        const { communityId, count = 25, method = 'GET' } = args as any;
        const res = await twitterAPI.callApiTools('CommunitiesMemberV2', method, { communityId, count });
        return { content: [{ type: 'text', text: JSON.stringify(res, null, 2) }] };
      }
      case 'twitter_topic_list': {
        const { topicId, method = 'GET' } = args as any;
        const res = await twitterAPI.callApiTools('TopicListV2', method, { topicId });
        return { content: [{ type: 'text', text: JSON.stringify(res, null, 2) }] };
      }

      // TWEETS CATEGORY
      case 'twitter_get_quotes': {
        const { tweetId, count = 25, method = 'GET' } = args as any;
        const res = await twitterAPI.callApiTools('quotesV2', method, { tweetId, count });
        return { content: [{ type: 'text', text: JSON.stringify(res, null, 2) }] };
      }
      case 'twitter_get_favoriters': {
        const { tweetId, count = 25, method = 'GET' } = args as any;
        const res = await twitterAPI.callApiTools('favoritersV2', method, { tweetId, count });
        return { content: [{ type: 'text', text: JSON.stringify(res, null, 2) }] };
      }
      case 'twitter_get_retweeters': {
        const { tweetId, count = 25, method = 'GET' } = args as any;
        const res = await twitterAPI.callApiTools('retweetersV2', method, { tweetId, count });
        return { content: [{ type: 'text', text: JSON.stringify(res, null, 2) }] };
      }
      case 'twitter_get_favorites_list': {
        const { userId, count = 25, method = 'GET' } = args as any;
        const res = await twitterAPI.callApiTools('favoritesList', method, { userId, count });
        return { content: [{ type: 'text', text: JSON.stringify(res, null, 2) }] };
      }
      case 'twitter_tweet_reply': {
        const { tweetId, count = 25, method = 'GET' } = args as any;
        const res = await twitterAPI.callApiTools('userTweetReply', method, { tweetId, count });
        return { content: [{ type: 'text', text: JSON.stringify(res, null, 2) }] };
      }

      // USERS CATEGORY
      case 'twitter_user_timeline': {
        const { userId, username, count = 25, method = 'GET' } = args as any;
        const params = userId ? { userId } : { username };
        const res = await twitterAPI.callApiTools('userTimeline', method, { ...params, count });
        return { content: [{ type: 'text', text: JSON.stringify(res, null, 2) }] };
      }
      case 'twitter_user_tweets_v2': {
        const { userId, count = 25, method = 'GET' } = args as any;
        const res = await twitterAPI.callApiTools('userTweetsV2', method, { userId, count });
        return { content: [{ type: 'text', text: JSON.stringify(res, null, 2) }] };
      }
      case 'twitter_user_likes': {
        const { userId, count = 25, method = 'GET' } = args as any;
        const res = await twitterAPI.callApiTools('userLikeV2', method, { userId, count });
        return { content: [{ type: 'text', text: JSON.stringify(res, null, 2) }] };
      }
      case 'twitter_users_by_ids': {
        const { userIds, method = 'GET' } = args as any;
        const res = await twitterAPI.callApiTools('usersByIdRestIds', method, { userIds });
        return { content: [{ type: 'text', text: JSON.stringify(res, null, 2) }] };
      }
      case 'twitter_user_by_id': {
        const { userId, method = 'GET' } = args as any;
        const res = await twitterAPI.callApiTools('uerByIdRestIdV2', method, { userId });
        return { content: [{ type: 'text', text: JSON.stringify(res, null, 2) }] };
      }
      case 'twitter_user_highlights': {
        const { userId, method = 'GET' } = args as any;
        const res = await twitterAPI.callApiTools('highlightsV2', method, { userId });
        return { content: [{ type: 'text', text: JSON.stringify(res, null, 2) }] };
      }
      case 'twitter_get_user_token': {
        const { username, method = 'GET' } = args as any;
        const res = await twitterAPI.callApiTools('getToken', method, { username });
        return { content: [{ type: 'text', text: JSON.stringify(res, null, 2) }] };
      }
      case 'twitter_token_sync': {
        const { token, method = 'GET' } = args as any;
        const res = await twitterAPI.callApiTools('tokenSync', method, { token });
        return { content: [{ type: 'text', text: JSON.stringify(res, null, 2) }] };
      }

      // LISTS CATEGORY
      case 'twitter_list_members': {
        const { listId, count = 25, method = 'GET' } = args as any;
        const res = await twitterAPI.callApiTools('listMembersByListIdV2', method, { listId, count });
        return { content: [{ type: 'text', text: JSON.stringify(res, null, 2) }] };
      }

      // AUTH CATEGORY
      case 'twitter_login': {
        const { username, password } = args as any;
        const res = await twitterAPI.callApiTools('loginPost', 'POST', { username, password });
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
  console.error('Twitter MCP Server ULTIMATE (57 working endpoints) running on stdio');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}