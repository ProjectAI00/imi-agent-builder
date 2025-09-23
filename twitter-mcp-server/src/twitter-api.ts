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
    const internalApiKey = process.env.TWITTER_INTERNAL_API_KEY || this.rapidApiKey;
    return this.request('GET', '/base/apitools/search', {
      query: { 
        words: query,  // Changed from 'query' to 'words'
        count: Math.min(count, 100),
        apiKey: internalApiKey,
        resFormat: 'json',
        topicId: '702',  // Required parameter from API docs
        // Removed cursor parameter as it was causing BadRequest error
        ...(lang && { lang })
      },
    });
  }

  async getTweet(tweetId: string) {
    return this.request('GET', '/1.1/statuses/show.json', {
      query: { id: tweetId, tweet_mode: 'extended' },
    });
  }

  async getUserByUsername(username: string) {
    return this.request('GET', '/1.1/users/show.json', {
      query: { screen_name: username },
    });
  }

  async getUserTweets(params: { userId?: string; username?: string; count?: number }) {
    const { userId, username, count = 25 } = params;
    return this.request('GET', '/1.1/statuses/user_timeline.json', {
      query: {
        user_id: userId,
        screen_name: username,
        count: Math.min(count, 200),
        tweet_mode: 'extended',
      },
    });
  }

  async sendTweet(status: string) {
    // Some providers accept query params; we default to body JSON
    return this.request('POST', '/1.1/statuses/update.json', {
      body: { status },
    });
  }

  async followUser(params: { userId?: string; username?: string }) {
    const { userId, username } = params;
    return this.request('POST', '/1.1/friendships/create.json', {
      body: { user_id: userId, screen_name: username, follow: true },
    });
  }

  async sendDM(params: { senderId: string; recipientId: string; text: string }) {
    const { senderId, recipientId, text } = params;
    // v1.1 DM events shape
    const event = {
      event: {
        type: 'message_create',
        message_create: {
          target: { recipient_id: recipientId },
          sender_id: senderId,
          message_data: { text },
        },
      },
    };
    return this.request('POST', '/1.1/direct_messages/events/new.json', { body: event });
  }

  /**
   * Call a provider endpoint under /base/apitools/{endpoint}
   * Many RapidAPI providers expect query params (even for POST) and often require apiKey and resFormat=json.
   * Optionally include auth_token and ct0 for write/privileged endpoints.
   */
  async callApiTools<T = any>(endpoint: string, method: HttpMethod = 'GET', params: Record<string, any> = {}, options?: { includeAuth?: boolean, apiKeyOverride?: string, authToken?: string, ct0?: string }) {
    const apiKey = options?.apiKeyOverride || process.env.RAPIDAPI_TWITTER_APIKEY || process.env.TWITTER_INTERNAL_API_KEY || params.apiKey;
    const authToken = options?.authToken || process.env.TWITTER_AUTH_TOKEN;
    const ct0 = options?.ct0 || process.env.TWITTER_CT0;

    const query: Record<string, any> = {
      resFormat: 'json',
      ...params,
    };
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
}
