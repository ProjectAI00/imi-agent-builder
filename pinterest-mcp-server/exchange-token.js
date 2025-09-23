import axios from 'axios';

// Your Pinterest App credentials
const APP_ID = '1515331';
const APP_SECRET = '462bb0a5cc58c5f0f41684a9126fc70f4ac44fa2';
const REDIRECT_URI = 'http://localhost:8085/';

// Authorization code from the URL
const AUTHORIZATION_CODE = '5246999b109336b4b1a890626e5aac831847152';

async function exchangeCodeForToken() {
  console.log('🔄 Exchanging authorization code for access token...');
  
  try {
    const params = new URLSearchParams({
      grant_type: 'authorization_code',
      code: AUTHORIZATION_CODE,
      redirect_uri: REDIRECT_URI,
      client_id: APP_ID,
      client_secret: APP_SECRET,
    });
    
    const response = await axios.post('https://api.pinterest.com/v5/oauth/token', params, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });
    
    console.log('✅ Token Exchange Success!');
    console.log('=====================================');
    console.log('Access Token:', response.data.access_token);
    console.log('Token Type:', response.data.token_type);
    console.log('Scope:', response.data.scope);
    console.log('Expires In:', response.data.expires_in, 'seconds');
    console.log('=====================================');
    
    // Test the token immediately
    await testToken(response.data.access_token);
    
    return response.data;
  } catch (error) {
    console.error('❌ Token exchange failed:', error.response?.data || error.message);
    throw error;
  }
}

async function testToken(accessToken) {
  console.log('\n🧪 Testing access token with user account endpoint...');
  
  try {
    const response = await axios.get('https://api.pinterest.com/v5/user_account', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });
    
    console.log('✅ Token test successful!');
    console.log('User:', response.data.username || 'No username');
    console.log('Account Type:', response.data.account_type);
  } catch (error) {
    console.error('❌ Token test failed:', error.response?.status, error.response?.data);
  }
}

exchangeCodeForToken().catch(console.error);