import axios from 'axios';

const ACCESS_TOKEN = process.env.PINTEREST_ACCESS_TOKEN || 'your_pinterest_access_token_here';

async function testSimpleEndpoints() {
  console.log('Testing Pinterest API with simple endpoints...');
  
  const client = axios.create({
    baseURL: 'https://api.pinterest.com/v5',
    headers: {
      'Authorization': `Bearer ${ACCESS_TOKEN}`,
    },
  });
  
  try {
    console.log('1. Testing user account info...');
    const userResponse = await client.get('/user_account');
    console.log('✅ User account success:', {
      username: userResponse.data.username,
      first_name: userResponse.data.first_name,
      account_type: userResponse.data.account_type,
    });
    
    console.log('\n2. Testing boards...');
    const boardsResponse = await client.get('/boards', {
      params: { limit: 5 }
    });
    console.log(`✅ Boards success: Found ${boardsResponse.data.items?.length || 0} boards`);
    
    // If boards exist, try to get pins from a board
    if (boardsResponse.data.items && boardsResponse.data.items.length > 0) {
      const boardId = boardsResponse.data.items[0].id;
      console.log(`\n3. Testing pins from board ${boardId}...`);
      const pinsResponse = await client.get(`/boards/${boardId}/pins`, {
        params: { limit: 3 }
      });
      console.log(`✅ Board pins success: Found ${pinsResponse.data.items?.length || 0} pins`);
    }
    
    // Try a simple pins search (might fail in sandbox)
    console.log('\n4. Testing pins search (might fail in sandbox)...');
    try {
      const searchResponse = await client.get('/pins/search', {
        params: { query: 'design', limit: 5 }
      });
      console.log(`✅ Search success: Found ${searchResponse.data.items?.length || 0} pins`);
    } catch (searchError) {
      console.log('❌ Search failed (expected in sandbox):', searchError.response?.status);
    }
    
  } catch (error) {
    console.error('❌ API test failed:', error.response?.status, error.response?.data);
  }
}

testSimpleEndpoints();