// test-checker.js - Test a single restaurant checker with external browser
import dotenv from 'dotenv';
import puppeteer from 'puppeteer-core';
import { checkChope } from './checkers/chope.js';

dotenv.config();

async function testSingleChecker() {
    console.log('🔍 Testing single restaurant checker with external browser...\n');
    
    const browserWSEndpoint = process.env.BROWSERLESS_WS_ENDPOINT;
    
    if (!browserWSEndpoint) {
        console.error('❌ BROWSERLESS_WS_ENDPOINT not set');
        return;
    }
    
    try {
        console.log('🔗 Connecting to browser service...');
        const browser = await puppeteer.connect({
            browserWSEndpoint,
            ignoreHTTPSErrors: true,
        });
        
        console.log('✅ Connected! Creating new page...');
        const page = await browser.newPage();
        
        // Set user agent
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/109.0.0.0 Safari/537.36');
        page.setDefaultNavigationTimeout(60000);
        
        // Test with a simple restaurant
        const testRestaurant = {
            name: "Test Restaurant", 
            platform: "chope",
            url: "https://book.chope.co/booking?rid=test",
            slug: "test"
        };
        
        const testQuery = {
            date: "2025-09-29",
            partySize: "2", 
            time: "19:00"
        };
        
        console.log('🍽️ Testing restaurant checker...');
        console.log('Restaurant:', testRestaurant.name);
        console.log('Query:', testQuery);
        
        const result = await checkChope(page, testRestaurant, testQuery);
        
        console.log('✅ Checker completed successfully!');
        console.log('Result:', result);
        
        await page.close();
        await browser.disconnect();
        
        console.log('\n🎉 Single checker test passed!');
        console.log('The issue might be with multiple concurrent checkers or the Redis cache.');
        
    } catch (error) {
        console.error('❌ Single checker test failed:', error.message);
        console.error('Stack trace:', error.stack);
        
        if (error.message.includes('pipeline')) {
            console.log('\n💡 Pipeline error detected. This might be related to:');
            console.log('1. Redis connection issues');
            console.log('2. Multiple concurrent browser connections');
            console.log('3. URL parsing in the checker functions');
        }
    }
}

testSingleChecker();
