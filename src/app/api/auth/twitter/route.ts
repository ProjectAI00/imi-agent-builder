import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

export async function GET(request: NextRequest) {
  const clientId = process.env.TWITTER_CLIENT_ID;
  
  if (!clientId) {
    return NextResponse.json({ error: 'Missing TWITTER_CLIENT_ID (OAuth 2.0 client id)' }, { status: 500 });
  }

  // Generate PKCE code_verifier and code_challenge (S256)
  const codeVerifier = crypto.randomBytes(32).toString('base64url');
  const codeChallenge = crypto
    .createHash('sha256')
    .update(codeVerifier)
    .digest('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  // CSRF protection: generate state and persist alongside PKCE
  const state = crypto.randomBytes(16).toString('base64url');

  // Create Twitter OAuth URL
  const twitterAuthUrl = new URL('https://twitter.com/i/oauth2/authorize');
  twitterAuthUrl.searchParams.append('client_id', clientId);
  // Resolve redirect origin: explicit env override > request origin > fallback
  const configOrigin = process.env.OAUTH_REDIRECT_ORIGIN;
  const origin = configOrigin || request.nextUrl.origin || (process.env.BETTER_AUTH_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000'));
  twitterAuthUrl.searchParams.append('redirect_uri', `${origin}/api/auth/twitter/callback`);
  twitterAuthUrl.searchParams.append('response_type', 'code');
  // Scopes must match those enabled in the Twitter app settings exactly
  // Default to a minimal set; can be overridden via TWITTER_SCOPES
  const scopes = process.env.TWITTER_SCOPES || 'users.read tweet.read offline.access';
  twitterAuthUrl.searchParams.append('scope', scopes);
  twitterAuthUrl.searchParams.append('state', state);
  twitterAuthUrl.searchParams.append('code_challenge', codeChallenge);
  twitterAuthUrl.searchParams.append('code_challenge_method', 'S256');
  // Persist verifier/state in secure-ish cookies for the callback to validate
  const response = NextResponse.redirect(twitterAuthUrl.toString());
  response.cookies.set('twitter_pkce_verifier', codeVerifier, {
    httpOnly: true,
    sameSite: 'lax',
    secure: false, // set true behind HTTPS
    path: '/',
    maxAge: 600, // 10 minutes
  });
  response.cookies.set('twitter_oauth_state', state, {
    httpOnly: true,
    sameSite: 'lax',
    secure: false,
    path: '/',
    maxAge: 600,
  });
  return response;
}
