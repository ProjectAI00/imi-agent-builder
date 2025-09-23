import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const clientId = process.env.GITHUB_CLIENT_ID;
  
  if (!clientId) {
    return NextResponse.json({ error: 'GitHub client ID not configured' }, { status: 500 });
  }

  // Create GitHub OAuth URL
  const githubAuthUrl = new URL('https://github.com/login/oauth/authorize');
  githubAuthUrl.searchParams.append('client_id', clientId);
  githubAuthUrl.searchParams.append('redirect_uri', 'http://localhost:3000/api/auth/github/callback');
  githubAuthUrl.searchParams.append('scope', 'user:email');
  githubAuthUrl.searchParams.append('state', 'random-state-string');

  return NextResponse.redirect(githubAuthUrl.toString());
}