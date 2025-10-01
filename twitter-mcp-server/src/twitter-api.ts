import axios from 'axios';
import type { AxiosInstance, AxiosRequestConfig } from 'axios';

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface TwitterAPIOptions {
  rapidApiKey?: string;
  rapidApiHost?: string;
  baseURL?: string;
}

export class TwitterAPI {
  private client: AxiosInstance;
  private rapidApiKey: string;
  private rapidApiHost: string;

  constructor(options: TwitterAPIOptions = {}) {
    this.rapidApiKey = options.rapidApiKey || process.env.RAPIDAPI_KEY || 'your_rapidapi_key_here';
    this.rapidApiHost = options.rapidApiHost || process.env.RAPIDAPI_HOST || 'twitter-api-v1-1-enterprise.p.rapidapi.com';
    const baseURL = options.baseURL || process.env.RAPIDAPI_BASE_URL || 'https://twitter-api-v1-1-enterprise.p.rapidapi.com';

    this.client = axios.create({
      baseURL,
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'X-RapidAPI-Key': this.rapidApiKey,
        'X-RapidAPI-Host': this.rapidApiHost,
        'Host': this.rapidApiHost,
      },
      timeout: 15000,
    });
  }

  async request<T = any>(method: HttpMethod, path: string, options: { query?: Record<string, any>, body?: any, headers?: Record<string, string> } = {}): Promise<T> {
    const config: AxiosRequestConfig = {
      method,
      url: path,
      params: options.query,
      data: options.body,
      headers: options.headers,
      validateStatus: () => true,
    };
    const res = await this.client.request<T>(config);
    if (res.status >= 200 && res.status < 300) return res.data;
    throw new Error(`Twitter RapidAPI error ${res.status}: ${JSON.stringify(res.data)}`);
  }

  // Convenience wrappers for common operations (using correct /base/apitools/ endpoints)
  async searchTweets(query: string, count: number = 25, lang?: string) {
    return this.callApiTools('search', 'GET', {
      words: query,
      count: Math.min(count, 100),
      topicId: 702,
      ...(lang && { lang })
    });
  }

  async getTweet(tweetId: string) {
    // Use search to find tweet by ID (since tweetDetails doesn't exist)
    return this.callApiTools('search', 'GET', {
      words: `conversation_id:${tweetId}`,
      count: 1,
      topicId: 702
    });
  }

  async getUserByUsername(username: string) {
    // Use search to get user info by username
    return this.callApiTools('search', 'GET', {
      words: `from:${username}`,
      count: 1,
      topicId: 702
    });
  }

  async getUserTweets(params: { userId?: string; username?: string; count?: number }) {
    const { userId, username, count = 25 } = params;
    
    if (username) {
      // Use search with from: operator to get user tweets
      return this.callApiTools('search', 'GET', {
        words: `from:${username}`,
        count: Math.min(count, 100),
        topicId: 702
      });
    } else if (userId) {
      // First need to resolve userId to username, then search
      // For now, use search with user_id context if possible
      return this.callApiTools('search', 'GET', {
        words: `from_user_id:${userId}`,
        count: Math.min(count, 100),
        topicId: 702
      });
    } else {
      throw new Error('Either userId or username must be provided');
    }
  }

  async sendTweet(status: string) {
    // Note: tweet endpoint doesn't exist, may need to use a different endpoint
    // This would need to be tested with the correct endpoint name
    throw new Error('Send tweet functionality not yet implemented - need to discover correct endpoint');
  }

  async followUser(params: { userId?: string; username?: string }) {
    const { userId, username } = params;
    
    if (userId) {
      return this.callApiTools('follow', 'POST', {
        userId: userId
      }, { includeAuth: true });
    } else if (username) {
      return this.callApiTools('follow', 'POST', {
        username: username
      }, { includeAuth: true });
    } else {
      throw new Error('Either userId or username must be provided');
    }
  }

  async sendDM(params: { senderId: string; recipientId: string; text: string }) {
    // Note: sendMessage endpoint not confirmed to exist
    throw new Error('Send DM functionality not yet implemented - need to discover correct endpoint');
  }

  /**
   * Call a provider endpoint under /base/apitools/{endpoint}
   * Many RapidAPI providers expect query params (even for POST) and often require apiKey and resFormat=json.
   * Optionally include auth_token and ct0 for write/privileged endpoints.
   */
  async callApiTools<T = any>(endpoint: string, method: HttpMethod = 'GET', params: Record<string, any> = {}, options?: { includeAuth?: boolean, apiKeyOverride?: string, authToken?: string, ct0?: string }) {
    const apiKey = options?.apiKeyOverride || process.env.RAPIDAPI_TWITTER_APIKEY || process.env.TWITTER_INTERNAL_API_KEY || params.apiKey || this.rapidApiKey;
    const authToken = options?.authToken || process.env.TWITTER_AUTH_TOKEN;
    const ct0 = options?.ct0 || process.env.TWITTER_CT0;

    const query: Record<string, any> = {
      resFormat: 'json',
      ...params,
    };
    
    // Always include API key if available
    if (apiKey) query.apiKey = apiKey;
    
    if (options?.includeAuth) {
      if (authToken) query.auth_token = authToken;
      if (ct0) query.ct0 = ct0;
    }

    const path = `/base/apitools/${endpoint}`;
    // Most providers expect empty JSON body for POST when all params are query
    const body = method === 'POST' && !('body' in params) ? {} : undefined;
    return this.request<T>(method, path, { query, body });
  }

  /**
   * Batch multiple API calls in parallel for significant speed improvement
   * Returns results in same order as requests, with null for failed calls
   */
  async batchApiCalls<T = any>(requests: Array<{
    endpoint: string;
    method?: HttpMethod;
    params?: Record<string, any>;
    options?: { includeAuth?: boolean, apiKeyOverride?: string, authToken?: string, ct0?: string };
  }>): Promise<Array<T | null>> {
    const promises = requests.map(async (req, index) => {
      try {
        const result = await this.callApiTools<T>(
          req.endpoint,
          req.method || 'GET',
          req.params || {},
          req.options
        );
        return result;
      } catch (error) {
        console.error(`[BATCH] Request ${index} failed for endpoint ${req.endpoint}:`, error);
        return null;
      }
    });

    return Promise.all(promises);
  }

  /**
   * Get multiple users' profiles in parallel (much faster than sequential calls)
   */
  async getUserProfilesBatch(usernames: string[]): Promise<Array<any | null>> {
    const requests = usernames.map(username => ({
      endpoint: 'search',
      params: {
        words: `from:${username}`,
        count: 1,
        topicId: 702
      }
    }));

    return this.batchApiCalls(requests);
  }

  /**
   * Get multiple users' timelines in parallel
   */
  async getUserTimelinesBatch(users: Array<{ userId?: string; username?: string; count?: number }>): Promise<Array<any | null>> {
    const requests = users.map(user => {
      const { userId, username, count = 25 } = user;
      
      if (username) {
        return {
          endpoint: 'search',
          params: {
            words: `from:${username}`,
            count: Math.min(count, 100),
            topicId: 702
          }
        };
      } else if (userId) {
        return {
          endpoint: 'userTimeline',
          params: {
            userId,
            count: Math.min(count, 100)
          }
        };
      } else {
        throw new Error('Either userId or username must be provided');
      }
    });

    return this.batchApiCalls(requests);
  }

  /**
   * Get followers for multiple users in parallel
   */
  async getFollowersBatch(userIds: string[], count: number = 20): Promise<Array<any | null>> {
    const requests = userIds.map(userId => ({
      endpoint: 'followersListV2',
      params: { userId, count }
    }));

    return this.batchApiCalls(requests);
  }

  /**
   * Get following lists for multiple users in parallel
   */
  async getFollowingBatch(userIds: string[], count: number = 20): Promise<Array<any | null>> {
    const requests = userIds.map(userId => ({
      endpoint: 'followingsListV2',
      params: { userId, count }
    }));

    return this.batchApiCalls(requests);
  }
}
