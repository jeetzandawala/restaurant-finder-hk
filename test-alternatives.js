// test-alternatives.js - Test different browser services
import dotenv from 'dotenv';
dotenv.config();

console.log('🔍 Testing different browser service options...\n');

// Test 1: Check if Browserless.io token is configured
const browserlessEndpoint = process.env.BROWSERLESS_WS_ENDPOINT;
if (browserlessEndpoint) {
    console.log('✅ Browserless.io endpoint configured');
    console.log('🔗 Endpoint:', browserlessEndpoint.replace(/token=.*/, 'token=***'));
} else {
    console.log('❌ Browserless.io endpoint not configured');
}

// Test 2: Suggest alternatives
console.log('\n📋 Alternative browser services to try:');
console.log('1. 🆓 ScrapingBee (free tier): https://www.scrapingbee.com/');
console.log('2. 🆓 Puppeteer as a Service: https://puppeteer.dev/');
console.log('3. 🆓 Try a fresh Browserless.io token');

console.log('\n🔧 Quick fixes to try:');
console.log('1. Generate a new token at https://browserless.io');
console.log('2. Check account limits/usage');
console.log('3. Verify account is activated');
console.log('4. Try the token in a browser: https://chrome.browserless.io?token=YOUR_TOKEN');

// Test if we can reach browserless.io at all
console.log('\n🌐 Testing connectivity to browserless.io...');
try {
    const response = await fetch('https://chrome.browserless.io/');
    console.log('✅ Browserless.io is reachable');
} catch (error) {
    console.log('❌ Cannot reach browserless.io:', error.message);
}

console.log('\n💡 Next steps:');
console.log('1. Fix your Browserless.io token and try again');
console.log('2. Or set up an alternative service');
console.log('3. Once working locally, your Vercel deployment will work too!');
