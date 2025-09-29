// test-local.js - Simple local test
import checkHandler from './api/check.js';

// Mock request and response objects
function createMockRequest(date, time, partySize) {
  return {
    query: { date, time, partySize }
  };
}

function createMockResponse() {
  const headers = {};
  const response = {
    status: (code) => {
      response.statusCode = code;
      return response;
    },
    json: (data) => {
      response.data = data;
      return response;
    },
    setHeader: (key, value) => {
      headers[key] = value;
    },
    headers,
    statusCode: 200,
    data: null
  };
  return response;
}

async function testSimpleAPI() {
  console.log('🧪 Testing Local Restaurant Availability Checker');
  console.log('================================================');
  
  // Test with tomorrow's date
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const testDate = tomorrow.toISOString().split('T')[0];
  
  const testCases = [
    { date: testDate, time: '19:00', partySize: '2' },
    { date: testDate, time: '20:00', partySize: '4' }
  ];

  for (const testCase of testCases) {
    console.log(`\n🔍 Testing: ${testCase.date} at ${testCase.time} for ${testCase.partySize} people`);
    console.log('─'.repeat(60));
    
    const startTime = Date.now();
    
    try {
      const mockReq = createMockRequest(testCase.date, testCase.time, testCase.partySize);
      const mockRes = createMockResponse();
      
      await checkHandler(mockReq, mockRes);
      
      const duration = (Date.now() - startTime) / 1000;
      
      if (mockRes.statusCode === 200 && mockRes.data) {
        console.log(`✅ Success! (${duration.toFixed(1)}s)`);
        console.log(`📊 Results:`);
        console.log(`   Available: ${mockRes.data.available?.length || 0} restaurants`);
        console.log(`   Unavailable: ${mockRes.data.unavailable?.length || 0} restaurants`);
        console.log(`   Total checked: ${mockRes.data.totalRestaurants || 0} restaurants`);
        console.log(`   Cache status: ${mockRes.headers['X-Cache-Status'] || 'N/A'}`);
        console.log(`   Performance: ${mockRes.headers['X-Performance'] || 'N/A'}`);
        
        if (mockRes.data.available?.length > 0) {
          console.log(`\n🎉 Available restaurants:`);
          mockRes.data.available.slice(0, 3).forEach(restaurant => {
            console.log(`   • ${restaurant.name}`);
          });
          if (mockRes.data.available.length > 3) {
            console.log(`   ... and ${mockRes.data.available.length - 3} more`);
          }
        }
      } else {
        console.log(`❌ Failed with status ${mockRes.statusCode}`);
        console.log(`Error:`, mockRes.data);
      }
      
    } catch (error) {
      const duration = (Date.now() - startTime) / 1000;
      console.log(`💥 Error after ${duration.toFixed(1)}s:`, error.message);
    }
  }
  
  console.log('\n🏁 Local testing complete!');
  console.log('\n💡 Next steps:');
  console.log('   1. If tests pass → Deploy to Railway');
  console.log('   2. If tests fail → Check the error messages above');
  console.log('   3. Add Redis for caching (optional but recommended)');
}

// Run the test
testSimpleAPI().catch(console.error);
