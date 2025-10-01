import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const returnedState = searchParams.get('state');
  const cookies = request.cookies;
  const storedVerifier = cookies.get('twitter_pkce_verifier')?.value;
  const storedState = cookies.get('twitter_oauth_state')?.value;
  
  console.log('[TWITTER] Callback received:', { code: code?.substring(0, 20) + '...' });
  
  if (!code) {
    console.error('[TWITTER] No authorization code received');
    const baseUrl = process.env.BETTER_AUTH_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');
    return NextResponse.redirect(`${baseUrl}/chat?error=no_code`);
  }

  // Validate state to mitigate CSRF
  if (!returnedState || !storedState || returnedState !== storedState) {
    console.error('[TWITTER] Invalid or missing state parameter');
    const baseUrl = process.env.BETTER_AUTH_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');
    return NextResponse.redirect(`${baseUrl}/chat?error=invalid_state`);
  }

  try {
    console.log('[TWITTER] Exchanging code for access token...');
    
    // Exchange code for access token using Twitter OAuth 2.0
    const clientId = process.env.TWITTER_CLIENT_ID;
    const clientSecret = process.env.TWITTER_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      console.error('[TWITTER] Missing TWITTER_CLIENT_ID or TWITTER_CLIENT_SECRET');
      return NextResponse.redirect(`${process.env.BETTER_AUTH_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')}/chat?error=missing_client`);
    }
    
    const tokenRequestBody = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: `${process.env.OAUTH_REDIRECT_ORIGIN || request.nextUrl.origin}/api/auth/twitter/callback`,
      client_id: clientId!,
      code_verifier: storedVerifier || 'challenge',
    });
    
    console.log('[TWITTER] Token request body:', tokenRequestBody.toString());
    console.log('[TWITTER] Using Twitter OAuth 2.0');
    
    const tokenResponse = await fetch('https://api.twitter.com/2/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
        'Authorization': `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
      },
      body: tokenRequestBody,
    });

    console.log('[TWITTER] Token response status:', tokenResponse.status);
    
    const tokenData = await tokenResponse.json();
    console.log('[TWITTER] Token data received:', { 
      hasAccessToken: !!tokenData.access_token, 
      error: tokenData.error,
      errorDescription: tokenData.error_description,
      fullResponse: tokenData 
    });
    
    if (tokenData.error) {
      console.error('[TWITTER] Token error:', tokenData);
      return NextResponse.redirect(`${process.env.BETTER_AUTH_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')}/chat?error=token_error`);
    }

    if (!tokenData.access_token) {
      console.error('[TWITTER] No access token in response');
      return NextResponse.redirect(`${process.env.BETTER_AUTH_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')}/chat?error=no_token`);
    }

    console.log('[TWITTER] Getting user info and extracting session tokens...');
    
    // Get user info from Twitter API v2
    const userResponse = await fetch('https://api.twitter.com/2/users/me', {
      headers: {
        'Authorization': `Bearer ${tokenData.access_token}`,
      },
    });

    console.log('[TWITTER] User response status:', userResponse.status);
    
    const userData = await userResponse.json();
    console.log('[TWITTER] User data:', { 
      id: userData.data?.id, 
      username: userData.data?.username, 
      name: userData.data?.name,
      error: userData.error 
    });

    if (userData.error) {
      console.error('[TWITTER] User info error:', userData);
      return NextResponse.redirect(`${process.env.BETTER_AUTH_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')}/chat?error=user_info_error`);
    }

    // Now try to extract session tokens using RapidAPI login
    console.log('[TWITTER] Attempting to extract session tokens for DM access...');
    let authToken = null;
    let ct0 = null;
    
    try {
      // Try to use the OAuth tokens to get session tokens via RapidAPI
      const rapidApiResponse = await fetch('https://twitter-api-v1-1-enterprise.p.rapidapi.com/base/apitools/getCt0', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-RapidAPI-Key': process.env.RAPIDAPI_KEY!,
          'X-RapidAPI-Host': 'twitter-api-v1-1-enterprise.p.rapidapi.com',
        },
        body: JSON.stringify({
          auth_token: tokenData.access_token,
          apiKey: process.env.RAPIDAPI_TWITTER_APIKEY,
          resFormat: 'json'
        })
      });
      
      if (rapidApiResponse.ok) {
        const sessionData = await rapidApiResponse.json();
        console.log('[TWITTER] Session token extraction result:', sessionData);
        
        if (sessionData.ct0) {
          ct0 = sessionData.ct0;
          authToken = tokenData.access_token;
          console.log('[TWITTER] Successfully extracted session tokens!');
        }
      }
    } catch (error) {
      console.log('[TWITTER] Could not extract session tokens:', error);
      // Continue without session tokens - OAuth tokens might still be useful
    }

    // Set cookie with Twitter user data and session tokens
    const cookieData = {
      id: userData.data?.id || userData.data?.username,
      name: userData.data?.name || userData.data?.username,
      username: userData.data?.username,
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      token: `twitter_${userData.data?.id || userData.data?.username}`, // For Tambo
      // Session tokens for RapidAPI DM functionality
      auth_token: authToken,
      ct0: ct0,
      // Store for RapidAPI integration
      rapidapi_key: process.env.RAPIDAPI_TWITTER_APIKEY,
    };
    
    console.log('[TWITTER] Setting auth cookie:', { 
      id: cookieData.id, 
      username: cookieData.username,
      hasAccessToken: !!cookieData.access_token,
      hasSessionTokens: !!(authToken && ct0)
    });
    
    const response = NextResponse.redirect(`${process.env.OAUTH_REDIRECT_ORIGIN || request.nextUrl.origin}/chat`);
    // Clear transient cookies
    response.cookies.set('twitter_pkce_verifier', '', { httpOnly: true, maxAge: 0, path: '/' });
    response.cookies.set('twitter_oauth_state', '', { httpOnly: true, maxAge: 0, path: '/' });
    response.cookies.set('twitter_auth', JSON.stringify(cookieData), {
      httpOnly: false, // Allow client-side access
      secure: false, // Set to true in production
      maxAge: 60 * 60 * 24 * 30, // 30 days
    });

    // Fire-and-forget: kick off local auto-capture to store web cookies
    try {
      const base = process.env.OAUTH_REDIRECT_ORIGIN || request.nextUrl.origin;
      fetch(`${base}/api/twitter/capture`, { method: 'POST' }).catch(() => {});
    } catch {}

    console.log('[TWITTER] Authentication completed successfully');
    return response;
  } catch (error) {
    console.error('[TWITTER] OAuth error:', error);
    return NextResponse.redirect(`${process.env.BETTER_AUTH_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')}/chat?error=auth_failed`);
  }
}
