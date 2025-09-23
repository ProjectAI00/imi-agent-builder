import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  
  console.log('[PINTEREST] Callback received:', { code: code?.substring(0, 20) + '...' });
  
  if (!code) {
    console.error('[PINTEREST] No authorization code received');
    const baseUrl = process.env.BETTER_AUTH_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');
    return NextResponse.redirect(`${baseUrl}/chat?error=no_code`);
  }

  try {
    console.log('[PINTEREST] Exchanging code for access token...');
    
    // Exchange code for access token using Basic Auth (Pinterest requirement)
    const credentials = Buffer.from(`${process.env.PINTEREST_CLIENT_ID!}:${process.env.PINTEREST_CLIENT_SECRET!}`).toString('base64');
    
    const tokenRequestBody = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      // Must exactly match the redirect_uri used when initiating auth
      redirect_uri: `${process.env.OAUTH_REDIRECT_ORIGIN || request.nextUrl.origin}/api/auth/pinterest/callback`,
    });
    
    console.log('[PINTEREST] Token request body:', tokenRequestBody.toString());
    console.log('[PINTEREST] Using Basic Auth for client credentials');
    
    const tokenResponse = await fetch('https://api.pinterest.com/v5/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
        'Authorization': `Basic ${credentials}`,
      },
      body: tokenRequestBody,
    });

    console.log('[PINTEREST] Token response status:', tokenResponse.status);
    
    const tokenData = await tokenResponse.json();
    console.log('[PINTEREST] Token data received:', { 
      hasAccessToken: !!tokenData.access_token, 
      error: tokenData.error,
      errorDescription: tokenData.error_description,
      fullResponse: tokenData 
    });
    
    if (tokenData.error) {
      console.error('[PINTEREST] Token error:', tokenData);
      return NextResponse.redirect(`${process.env.BETTER_AUTH_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')}/chat?error=token_error`);
    }

    if (!tokenData.access_token) {
      console.error('[PINTEREST] No access token in response');
      return NextResponse.redirect(`${process.env.BETTER_AUTH_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')}/chat?error=no_token`);
    }

    console.log('[PINTEREST] Getting user info...');
    
    // Get user info
    const userResponse = await fetch('https://api.pinterest.com/v5/user_account', {
      headers: {
        'Authorization': `Bearer ${tokenData.access_token}`,
      },
    });

    console.log('[PINTEREST] User response status:', userResponse.status);
    
    const userData = await userResponse.json();
    console.log('[PINTEREST] User data:', { 
      id: userData.id, 
      username: userData.username, 
      firstName: userData.first_name,
      error: userData.error 
    });

    if (userData.error) {
      console.error('[PINTEREST] User info error:', userData);
      return NextResponse.redirect(`${process.env.BETTER_AUTH_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')}/chat?error=user_info_error`);
    }

    // Set cookie with Pinterest user data
    const cookieData = {
      id: userData.id || userData.username,
      name: userData.first_name || userData.username,
      username: userData.username,
      access_token: tokenData.access_token,
      token: `pinterest_${userData.id || userData.username}`, // For Tambo
    };
    
    console.log('[PINTEREST] Setting auth cookie:', { 
      id: cookieData.id, 
      username: cookieData.username,
      hasAccessToken: !!cookieData.access_token 
    });
    
    const response = NextResponse.redirect(`${process.env.OAUTH_REDIRECT_ORIGIN || request.nextUrl.origin}/chat`);
    response.cookies.set('pinterest_auth', JSON.stringify(cookieData), {
      httpOnly: false, // Allow client-side access
      secure: false, // Set to true in production
      maxAge: 60 * 60 * 24 * 30, // 30 days
    });

    console.log('[PINTEREST] Authentication completed successfully');
    return response;
  } catch (error) {
    console.error('[PINTEREST] OAuth error:', error);
    return NextResponse.redirect(`${process.env.BETTER_AUTH_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')}/chat?error=auth_failed`);
  }
}
