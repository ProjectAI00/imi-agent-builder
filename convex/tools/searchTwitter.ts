import { createTool } from "@convex-dev/agent";
import { z } from "zod";

/**
 * Twitter Search Tool
 *
 * Searches Twitter via RapidAPI directly
 * No MCP server needed - calls RapidAPI from Convex cloud
 */

const TwitterTweetSchema = z.object({
  id: z.string(),
  text: z.string(),
  user: z.object({
    id: z.string(),
    name: z.string(),
    username: z.string(),
    profileImageUrl: z.string().optional(),
  }).optional(),
  createdAt: z.string().optional(),
  metrics: z.object({
    likes: z.number().optional(),
    retweets: z.number().optional(),
    replies: z.number().optional(),
  }).optional(),
});

export const searchTwitter = createTool({
  description: `Search Twitter for tweets and analyze the full results you get back. Use specific query formats:
  - "from:username" to get a user's own tweets
  - "@username" to find mentions of a user
  - "keyword" for general search

  Returns an array of tweets with full text, user info, and engagement metrics.

  CRITICAL USAGE INSTRUCTIONS:
  - Look through ALL the tweets returned, not just the first one or two
  - Find diverse content: look for tweets about their actual work, tech opinions, projects, patterns
  - Don't fixate on joke tweets or memes - those are fine to mention once but find their real content too
  - Each time you use this data, pull from DIFFERENT tweets to keep responses fresh
  - If you see a funny/meme tweet with high engagement, acknowledge it but also look for their substantive tweets
  - The full array is your dataset - explore it thoroughly

  ACCURACY RULES:
  - Only use information directly found in the tweets text
  - Do not make assumptions about people, locations, or events
  - If a tweet is obviously a joke (like raising money from a video game), treat it as a joke, not fact`,

  args: z.object({
    query: z.string().describe(`Twitter search query. Examples:
    - "from:elonmusk" = get user's own tweets
    - "@elonmusk" = find mentions
    - "AI startups" = keyword search`),
    limit: z.number().min(1).max(50).default(20).describe("Number of tweets to return (1-50, default: 20 for speed)"),
    lang: z.string().optional().describe("Language code (optional, e.g., 'en', 'es')"),
  }),

  handler: async (ctx, args): Promise<{
    query: string;
    tweets: Array<z.infer<typeof TwitterTweetSchema>>;
  }> => {
    const startTime = Date.now();

    try {
      // Log tool execution
      console.log(`[Twitter Search] Query: "${args.query}", Limit: ${args.limit}`);

      // Call RapidAPI directly (Convex can't access localhost)
      const rapidApiKey = process.env.RAPIDAPI_KEY;
      const rapidApiHost = process.env.RAPIDAPI_HOST || "twitter-api-v1-1-enterprise.p.rapidapi.com";
      const apiKey = process.env.RAPIDAPI_TWITTER_APIKEY;

      if (!rapidApiKey) {
        console.error("[Twitter Search] RAPIDAPI_KEY not configured");
        throw new Error("Twitter API key not configured");
      }

      if (!apiKey) {
        console.error("[Twitter Search] RAPIDAPI_TWITTER_APIKEY not configured");
        throw new Error("Twitter API internal key not configured");
      }

      // Build query parameters
      const params = new URLSearchParams({
        words: args.query,
        count: args.limit.toString(), // Use the full limit requested
        topicId: "702",
        apiKey: apiKey,
        resFormat: "json",
        ...(args.lang && { lang: args.lang }),
      });

      const url = `https://${rapidApiHost}/base/apitools/search?${params}`;

      console.log(`[Twitter Search] Calling RapidAPI directly`);

      const response = await fetch(url, {
        method: "GET",
        headers: {
          "X-RapidAPI-Key": rapidApiKey,
          "X-RapidAPI-Host": rapidApiHost,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[Twitter Search] RapidAPI error: ${response.status} ${errorText}`);
        throw new Error(`Twitter API error: ${response.status}`);
      }

      const data = await response.json();

      console.log(`[Twitter Search] RapidAPI response code: ${data.code}`);

      // Extract tweets from the RapidAPI response structure
      const instructions = data?.data?.data?.search_by_raw_query?.search_timeline?.timeline?.instructions || [];
      let rawTweets: any[] = [];

      // Parse the complex Twitter API response structure
      for (const instruction of instructions) {
        const entries = instruction.entries || instruction.addEntries?.entries || [];
        for (const entry of entries) {
          if (entry.content?.itemContent?.tweet_results?.result) {
            rawTweets.push(entry.content.itemContent.tweet_results.result);
          }
        }
      }

      console.log(`[Twitter Search] Found ${rawTweets.length} tweets`);

      // Transform the response to match our schema
      const tweets = rawTweets.slice(0, args.limit).map((tweet: any) => {
        const legacy = tweet.legacy || {};
        const user = tweet.core?.user_results?.result?.legacy || {};

        return {
          id: tweet.rest_id || legacy.id_str || "",
          text: legacy.full_text || legacy.text || "",
          user: user.screen_name ? {
            id: tweet.core?.user_results?.result?.rest_id || "",
            name: user.name || "",
            username: user.screen_name || "",
            profileImageUrl: user.profile_image_url_https || user.profile_image_url,
          } : undefined,
          createdAt: legacy.created_at,
          metrics: {
            likes: legacy.favorite_count,
            retweets: legacy.retweet_count,
            replies: legacy.reply_count,
          },
        };
      });

      const executionTime = Date.now() - startTime;

      // Tool execution logged automatically by agent component

      console.log(`[Twitter Search] Found ${tweets.length} tweets in ${executionTime}ms`);

      return {
        query: args.query,
        tweets,
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      console.error("[Twitter Search] Error:", errorMessage);
      throw new Error(`Failed to search Twitter: ${errorMessage}`);
    }
  },
});