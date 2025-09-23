import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  
  if (!code) {
    return NextResponse.redirect('/chat?error=no_code');
  }

  try {
    // Exchange code for access token
    const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: process.env.GITHUB_CLIENT_ID,
        client_secret: process.env.GITHUB_CLIENT_SECRET,
        code,
      }),
    });

    const tokenData = await tokenResponse.json();
    
    if (tokenData.error) {
      return NextResponse.redirect('/chat?error=token_error');
    }

    // Get user info
    const userResponse = await fetch('https://api.github.com/user', {
      headers: {
        'Authorization': `Bearer ${tokenData.access_token}`,
      },
    });

    const userData = await userResponse.json();

    // For demo, we'll set a simple cookie with user info
    const response = NextResponse.redirect('/chat');
    response.cookies.set('auth_user', JSON.stringify({
      id: userData.id,
      name: userData.name || userData.login,
      email: userData.email,
      avatar: userData.avatar_url,
      token: `github_${userData.id}`, // Simple token for Tambo
    }), {
      httpOnly: false, // Allow client-side access for demo
      secure: false, // Set to true in production
      maxAge: 60 * 60 * 24 * 7, // 1 week
    });

    return response;
  } catch (error) {
    console.error('GitHub OAuth error:', error);
    return NextResponse.redirect('/chat?error=auth_failed');
  }
}