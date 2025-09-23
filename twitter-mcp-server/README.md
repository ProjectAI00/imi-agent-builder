Twitter MCP Server (RapidAPI)

Overview
- MCP server exposing Twitter operations via RapidAPI.
- Ships both stdio and HTTP/SSE transports.

Environment
- RAPIDAPI_KEY: Your RapidAPI key
- RAPIDAPI_HOST: Defaults to twitter-api-v1-1-enterprise.p.rapidapi.com
- RAPIDAPI_BASE_URL: Defaults to https://twitter-api-v1-1-enterprise.p.rapidapi.com
- PORT: HTTP server port (default 3002)

Scripts
- dev (stdio): ts-node --esm src/server.ts
- dev:http (HTTP/SSE): ts-node --esm src/http-server.ts

Tools
- call_twitter_apitools (generic /base/apitools/*)
- twitter_communities_call (apitools passthrough)
- twitter_dms_call (apitools passthrough)
- twitter_follows_call (apitools passthrough)
- twitter_notifications_call (apitools passthrough)
- twitter_get_twees_call (apitools passthrough)
- twitter_lists_call (apitools passthrough)
- twitter_login_get_token_call (apitools passthrough)
- twitter_search_call (apitools passthrough)
- twitter_send_twees_call (apitools passthrough)
- twitter_users_call (apitools passthrough)

Notes
- Do not hardcode secrets. Provide RAPIDAPI_KEY via env.
- This provider uses apitools endpoints (e.g., /base/apitools/followersListV2). Official v1.1 paths like /1.1/users/show.json are not exposed.
- Prefer call_twitter_apitools for all operations. For username→userId, use `endpoint: search` with params `{ words: 'from:<username>', topicId: 702 }` and extract the author rest_id.

Discovery script
- scripts/probe-apitools.ts: probes a list of apitools endpoints with parameter synonyms and writes a catalog to `.data/apitools-catalog.json`.
- Usage: `ts-node --esm scripts/probe-apitools.ts followersListV2 followingsListV2 followersIds`
