import { MockPinterestAPI } from './dist/mock-pinterest-api.js';

async function testMockAPI() {
  console.log('Testing Mock Pinterest API...');
  
  const pinterest = new MockPinterestAPI();
  
  try {
    console.log('1. Testing search pins...');
    const pins = await pinterest.searchPins('kitchen', 3);
    console.log(`✅ Found ${pins.length} pins`);
    pins.forEach((pin, index) => {
      console.log(`   ${index + 1}. ${pin.title} (${pin.id})`);
    });
    
    console.log('\n2. Testing user boards...');
    const boards = await pinterest.getUserBoards(3);
    console.log(`✅ Found ${boards.length} boards`);
    boards.forEach((board, index) => {
      console.log(`   ${index + 1}. ${board.name} (${board.pin_count} pins)`);
    });
    
    if (boards.length > 0) {
      console.log(`\n3. Testing board pins for "${boards[0].name}"...`);
      const boardPins = await pinterest.getBoardPins(boards[0].id, 2);
      console.log(`✅ Found ${boardPins.length} pins in board`);
      boardPins.forEach((pin, index) => {
        console.log(`   ${index + 1}. ${pin.title}`);
      });
    }
    
    if (pins.length > 0) {
      console.log(`\n4. Testing get single pin...`);
      const singlePin = await pinterest.getPin(pins[0].id);
      console.log(`✅ Retrieved pin: ${singlePin.title}`);
    }
    
    console.log('\n🎉 Mock Pinterest API test completed successfully!');
  } catch (error) {
    console.error('❌ Mock API test failed:', error.message);
  }
}

testMockAPI();