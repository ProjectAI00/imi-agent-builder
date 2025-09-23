import { PinterestAPI } from './dist/pinterest-api.js';

const ACCESS_TOKEN = process.env.PINTEREST_ACCESS_TOKEN || 'your_pinterest_access_token_here';

async function testPinterestAPI() {
  console.log('Testing Pinterest API connection...');
  
  const pinterest = new PinterestAPI(ACCESS_TOKEN);
  
  try {
    console.log('1. Testing search pins...');
    const pins = await pinterest.searchPins('modern kitchen design', 5);
    console.log(`Found ${pins.length} pins`);
    if (pins.length > 0) {
      console.log('Sample pin:', {
        id: pins[0].id,
        title: pins[0].title,
        hasImage: !!pins[0].image,
      });
    }
    
    console.log('\n2. Testing user boards...');
    const boards = await pinterest.getUserBoards(3);
    console.log(`Found ${boards.length} boards`);
    if (boards.length > 0) {
      console.log('Sample board:', {
        id: boards[0].id,
        name: boards[0].name,
        pinCount: boards[0].pin_count,
      });
    }
    
    console.log('\n✅ Pinterest API test completed successfully!');
  } catch (error) {
    console.error('❌ Pinterest API test failed:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
  }
}

testPinterestAPI();