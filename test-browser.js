// test-browser.js - Simple test of the browser service
import dotenv from 'dotenv';
import puppeteer from 'puppeteer-core';

// Load environment variables
dotenv.config();

async function testBrowserService() {
    console.log('Testing browser service connection...');
    
    const browserWSEndpoint = process.env.BROWSERLESS_WS_ENDPOINT;
    
    if (!browserWSEndpoint) {
        console.error('❌ BROWSERLESS_WS_ENDPOINT not set in .env file');
        console.log('Please create .env file with:');
        console.log('BROWSERLESS_WS_ENDPOINT=wss://chrome.browserless.io?token=YOUR_TOKEN');
        return;
    }
    
    try {
        console.log('🔗 Connecting to browser service...');
        const browser = await puppeteer.connect({
            browserWSEndpoint,
            ignoreHTTPSErrors: true,
        });
        
        console.log('✅ Connected successfully!');
        
        const page = await browser.newPage();
        await page.goto('https://example.com');
        const title = await page.title();
        console.log(`📄 Test page title: ${title}`);
        
        await page.close();
        await browser.disconnect();
        
        console.log('🎉 Browser service is working correctly!');
        console.log('Your restaurant checker should work on Vercel now.');
        
    } catch (error) {
        console.error('❌ Browser service test failed:', error.message);
        console.log('Please check your Browserless.io token and try again.');
    }
}

testBrowserService();
