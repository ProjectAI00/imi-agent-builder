import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const clientId = process.env.PINTEREST_CLIENT_ID;
  
  if (!clientId) {
    return NextResponse.json({ error: 'Pinterest client ID not configured' }, { status: 500 });
  }

  // Create Pinterest OAuth URL (Pinterest uses different format)
  const pinterestAuthUrl = new URL('https://www.pinterest.com/oauth/');
  pinterestAuthUrl.searchParams.append('client_id', clientId);
  // Resolve redirect origin: explicit env override > request origin > fallback
  const configOrigin = process.env.OAUTH_REDIRECT_ORIGIN;
  const origin = configOrigin || request.nextUrl.origin || (process.env.BETTER_AUTH_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000'));
  pinterestAuthUrl.searchParams.append('redirect_uri', `${origin}/api/auth/pinterest/callback`);
  pinterestAuthUrl.searchParams.append('response_type', 'code');
  pinterestAuthUrl.searchParams.append('scope', 'boards:read,pins:read,user_accounts:read');
  pinterestAuthUrl.searchParams.append('state', 'random-state-string');

  return NextResponse.redirect(pinterestAuthUrl.toString());
}
