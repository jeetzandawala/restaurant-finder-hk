// test-api-simple.js - Test API without Redis to isolate the pipeline error
import dotenv from 'dotenv';
import puppeteer from 'puppeteer-core';
import fs from 'fs';
import path from 'path';

// Import checker functions
import { checkChope } from './checkers/chope.js';

dotenv.config();

async function testAPILogic() {
    console.log('🔍 Testing API logic without Redis...\n');
    
    const browserWSEndpoint = process.env.BROWSERLESS_WS_ENDPOINT;
    
    if (!browserWSEndpoint) {
        console.error('❌ BROWSERLESS_WS_ENDPOINT not set');
        return;
    }
    
    let browser = null;
    
    try {
        // Simulate the API call parameters
        const query = { date: '2025-09-29', partySize: '2', time: '19:00' };
        
        console.log('📄 Loading restaurants.json...');
        const jsonPath = path.join(process.cwd(), 'restaurants.json');
        const restaurants = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
        console.log(`Found ${restaurants.length} restaurants`);
        
        console.log('🔗 Connecting to browser service...');
        browser = await puppeteer.connect({
            browserWSEndpoint,
            ignoreHTTPSErrors: true,
        });
        console.log('✅ Browser connected');
        
        const results = { available: [], unavailable: [], generatedAt: new Date().toISOString() };
        
        // Test with just the first restaurant to avoid complexity
        const testRestaurant = restaurants[0];
        console.log(`🍽️ Testing with: ${testRestaurant.name} (${testRestaurant.platform})`);
        
        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/109.0.0.0 Safari/537.36');
        page.setDefaultNavigationTimeout(60000);
        
        try {
            let result;
            if (testRestaurant.platform === 'chope') {
                result = await checkChope(page, testRestaurant, query);
            } else {
                result = { name: testRestaurant.name, status: 'skipped', url: testRestaurant.url };
            }
            
            console.log('📊 Result:', result);
            
            if (result.status === 'available') {
                results.available.push(result);
            } else {
                results.unavailable.push(result);
            }
            
        } finally {
            await page.close();
        }
        
        await browser.disconnect();
        
        console.log('\n✅ API logic test completed successfully!');
        console.log('Final results:', JSON.stringify(results, null, 2));
        
        return results;
        
    } catch (error) {
        console.error('❌ API logic test failed:', error.message);
        console.error('Stack:', error.stack);
        
        if (error.message.includes('pipeline')) {
            console.log('\n💡 Pipeline error still occurring. This might be:');
            console.log('1. Browser service connection issue');
            console.log('2. Page handling problem'); 
            console.log('3. JavaScript execution issue in the checker');
        }
        
        return null;
    } finally {
        if (browser) {
            try {
                await browser.disconnect();
            } catch (e) {
                console.warn('Error disconnecting browser:', e.message);
            }
        }
    }
}

testAPILogic();
