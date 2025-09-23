import express from 'express';
import axios from 'axios';
import { createServer } from 'http';

// Your Pinterest App credentials
const APP_ID = '1515331';
const APP_SECRET = '462bb0a5cc58c5f0f41684a9126fc70f4ac44fa2';
const REDIRECT_URI = 'http://localhost:8085/';
const SCOPES = 'user_accounts:read,pins:read,boards:read';

async function getOAuthToken() {
  console.log('🔐 Pinterest OAuth Flow Started');
  console.log('=====================================');
  
  // Create temporary server for OAuth callback
  const app = express();
  let server;
  
  app.get('/', (req, res) => {
    const { code, state } = req.query;
    
    if (code) {
      console.log('✅ Authorization code received:', code);
      
      // Exchange code for access token
      exchangeCodeForToken(code)
        .then(tokenData => {
          res.send(`
            <h1>✅ Pinterest OAuth Success!</h1>
            <p><strong>Access Token:</strong> <code>${tokenData.access_token}</code></p>
            <p><strong>Scope:</strong> ${tokenData.scope}</p>
            <p><strong>Token Type:</strong> ${tokenData.token_type}</p>
            <p>You can now close this window and use the access token in your application.</p>
          `);
          
          console.log('\n🎉 OAuth Flow Complete!');
          console.log('Access Token:', tokenData.access_token);
          console.log('Scope:', tokenData.scope);
          
          // Close server after success
          setTimeout(() => {
            server.close();
            process.exit(0);
          }, 2000);
        })
        .catch(error => {
          console.error('❌ Token exchange failed:', error.message);
          res.send(`<h1>❌ Error</h1><p>${error.message}</p>`);
          server.close();
          process.exit(1);
        });
    } else {
      res.send('<h1>❌ No authorization code received</h1>');
    }
  });
  
  server = createServer(app);
  server.listen(8085, () => {
    const authUrl = `https://www.pinterest.com/oauth/?` + new URLSearchParams({
      response_type: 'code',
      redirect_uri: REDIRECT_URI,
      client_id: APP_ID,
      scope: SCOPES,
      state: 'random_state_string'
    }).toString();
    
    console.log('📱 Server running on http://localhost:8085');
    console.log('\n🌐 Open this URL in your browser to authorize:');
    console.log('=====================================');
    console.log(authUrl);
    console.log('=====================================');
    console.log('\n⏰ Waiting for authorization...');
  });
}

async function exchangeCodeForToken(code) {
  try {
    const response = await axios.post('https://api.pinterest.com/v5/oauth/token', {
      grant_type: 'authorization_code',
      code: code,
      redirect_uri: REDIRECT_URI,
      client_id: APP_ID,
      client_secret: APP_SECRET,
    }, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });
    
    return response.data;
  } catch (error) {
    throw new Error(`Token exchange failed: ${error.response?.data?.message || error.message}`);
  }
}

getOAuthToken();