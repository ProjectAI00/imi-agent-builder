# Pinterest AI Chat

Chat with your Pinterest boards using AI. Ask questions like "show me my kitchen ideas" or "find blue color schemes" and get instant results from your saved pins and boards.

## What it does

- Connect your Pinterest account securely
- Chat with AI about your Pinterest content
- Search through your boards and pins with natural language
- View your Pinterest collection in a clean interface
- Each user only sees their own Pinterest data

## Setup

You need:
- Node.js installed
- Pinterest Developer account (free)
- Tambo AI API key
- PostgreSQL database (Neon works well)

## Installation

1. Clone and install:
```bash
git clone https://github.com/ProjectAI00/pinterest-ai.git
cd pinterest-ai
npm install
```

2. Copy environment file:
```bash
cp example.env.local .env.local
```

3. Get your API keys:
- Pinterest: Make an app at developers.pinterest.com
- Tambo AI: Get key from tambo.co/dashboard
- Database: Create free PostgreSQL at neon.tech

4. Update `.env.local` with your keys

5. Run it:
```bash
npm run dev
```

### 4. Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd tambohack
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp example.env.local .env.local
```

4. Configure `.env.local` with your credentials:
```env
# Tambo AI
NEXT_PUBLIC_TAMBO_API_KEY=your_tambo_api_key_here

# Database
DATABASE_URL=your_postgresql_connection_string

# Pinterest OAuth
PINTEREST_CLIENT_ID=your_pinterest_client_id
PINTEREST_CLIENT_SECRET=your_pinterest_client_secret

# Authentication
BETTER_AUTH_SECRET=your_super_secret_key_min_32_chars
BETTER_AUTH_URL=http://localhost:3000

# GitHub OAuth (optional)
GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret
```

5. Start the development server:
```bash
npm run dev
```

6. Open [http://localhost:3000](http://localhost:3000) to view the app

## How It Works

### Pinterest Integration
- **OAuth Authentication** - Secure login with your Pinterest account
- **Board Management** - View and organize your Pinterest boards
- **Pin Discovery** - Search through your saved pins with AI
- **Content Caching** - Backend pre-fetches your Pinterest data for fast searches

### AI-Powered Features
- **Natural Language Search** - Ask "Find me kitchen ideas" and get relevant pins
- **Smart Content Discovery** - AI understands context and finds related content
- **Visual Pin Grids** - Beautiful Pinterest-style layouts
- **Intelligent Curation** - AI suggests relevant pins from your collections

### Current Limitations
- **Trial API Access** - Currently limited to your own pins and boards
- **Rate Limits** - 1000 requests per day (sufficient for personal use)
- **Search Scope** - Limited to your saved content (not public Pinterest search)

## Architecture

- **Frontend**: Next.js 15 with App Router, React 19, TypeScript
- **AI Integration**: Tambo AI for intelligent chat and component rendering
- **Authentication**: Better Auth with Pinterest OAuth
- **Database**: PostgreSQL for user data and Pinterest content caching
- **Styling**: Tailwind CSS with dark mode support
- **Pinterest API**: Pinterest API v5 for board and pin management

## Project Structure

```
src/
├── app/
│   ├── api/
│   │   ├── auth/pinterest/     # Pinterest OAuth endpoints
│   │   └── pinterest/          # Pinterest API routes
│   ├── chat/                   # Main chat interface
│   └── pinterest-integration/  # Pinterest-specific pages
├── components/
│   ├── pinterest/              # Pinterest-specific components
│   ├── tambo/                  # Tambo AI components
│   └── ui/                     # Reusable UI components
├── lib/
│   └── tambo.ts                # Tambo configuration and tools
└── services/
    └── pinterest-service.ts    # Pinterest API integration
```

## Available Scripts

```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run start        # Start production server
npm run lint         # Run ESLint
npm run lint:fix     # Fix ESLint errors automatically

## Claude Orchestrator (Plan A)

- Route: `POST /api/orchestrate/claude`
- Purpose: Run multi-step orchestration using the Claude Agent SDK while delegating tools/state to Convex.
- Config:
  - `CLAUDE_AGENT_ENABLED=true`
  - `ORCHESTRATOR_PROVIDER=claude`
  - `ANTHROPIC_API_KEY=...`
  - `NEXT_PUBLIC_CONVEX_URL=...`

Request body:
```
{
  "threadId": "...",
  "userId": "...",
  "promptMessageId": "...", // optional
  "userMessage": "..."       // optional (fallback to last user message planned in v2)
}
```

Response:
```
{ ok: true, threadId, userId, text }
```

Note: In v1 the route returns final text only (no SSE). Next we can wire it to append messages back to Convex or stream tokens.

### Local Dev Tunnel (Cloudflare)

Use Cloudflare Tunnel so Convex can reach your local orchestrator route.

1) Install cloudflared:
```
brew install cloudflare/cloudflare/cloudflared
```
2) Start Next and the tunnel:
```
npm run dev
npm run tunnel:cf
```
3) Restart Convex dev:
```
npx convex dev
```
This script sets `ORCHESTRATOR_URL` in Convex using a clean env file derived from `CONVEX_DEPLOYMENT` in `.env.local`.
```

## Usage Examples

### Chat with AI
- "Show me all my Pinterest boards"
- "Find me kitchen design ideas from my pins"
- "Search for blue color schemes in my saved pins"
- "What pins did I save last month?"

### Pinterest Features
- View all your boards in a visual grid
- Browse pins from specific boards
- Search through your saved content
- Get AI-powered content recommendations

## Upgrading to Standard Pinterest API Access

To search public Pinterest content (not just your own pins):

1. Apply for Standard Access at [Pinterest Developers](https://developers.pinterest.com/)
2. Provide business justification for your use case
3. Wait for approval (typically 1-2 weeks)
4. Update your app with Standard Access credentials

## Contributing

This project is part of an open source hackathon. Contributions are welcome!

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- Built with [Tambo AI](https://tambo.co/) for intelligent chat capabilities
- Powered by [Next.js](https://nextjs.org/) and [React](https://reactjs.org/)
- Pinterest integration via [Pinterest API v5](https://developers.pinterest.com/)
- UI components styled with [Tailwind CSS](https://tailwindcss.com/)
- Authentication powered by [Better Auth](https://better-auth.com/)
