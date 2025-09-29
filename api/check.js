// api/check.js
import { Redis } from '@upstash/redis';
import playwright from 'playwright-core';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Import all platform-specific checkers
import { checkSevenRooms } from '../checkers/sevenrooms.js';
import { checkTableCheck } from '../checkers/tablecheck.js';
import { checkResDiary } from '../checkers/resdiary.js';
import { checkChope } from '../checkers/chope.js';
import { checkBistrochat } from '../checkers/bistrochat.js';

// --- Caching Setup ---
// Initialize Redis client from environment variables provided by Vercel
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

const BATCH_SIZE = 5; // Increased batch size for better performance
const CACHE_EXPIRATION_SECONDS = 300; // Cache results for 5 minutes

const platformCheckers = {
  sevenrooms: checkSevenRooms,
  tablecheck: checkTableCheck,
  resdiary: checkResDiary,
  chope: checkChope,
  bistrochat: checkBistrochat,
};

export default async function handler(request, response) {
  let browser = null;
  try {
    const { date, partySize, time } = request.query;
    if (!date || !partySize || !time) {
      return response.status(400).json({ error: 'Missing required query parameters: date, partySize, time' });
    }
    const query = { date, partySize, time };

    // --- Cache-Aside Logic: Step 1 - Create Key & Check Cache ---
    const cacheKey = `reservations:${date}:${partySize}:${time}`;
    const cachedResults = await redis.get(cacheKey);

    if (cachedResults) {
      console.log('CACHE HIT:', cacheKey);
      // Set headers for cache status and return cached data
      response.setHeader('X-Cache-Status', 'HIT');
      response.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate');
      return response.status(200).json(cachedResults);
    }

    console.log('CACHE MISS:', cacheKey);
    response.setHeader('X-Cache-Status', 'MISS');
    
    // --- Cache Miss: Proceed with Scraping ---
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const jsonPath = path.join(__dirname, '..', 'restaurants.json');
    const restaurants = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));

    browser = await playwright.webkit.launch({ headless: true });
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15'
    });

    const results = { available: [], unavailable: [], generatedAt: new Date().toISOString() };

    for (let i = 0; i < restaurants.length; i += BATCH_SIZE) {
      const batch = restaurants.slice(i, i + BATCH_SIZE);
      const promises = batch.map(async (restaurant) => {
        const checker = platformCheckers[restaurant.platform];
        if (checker) {
          const page = await context.newPage();
          page.setDefaultNavigationTimeout(45000);
          try {
            // Block images, css, fonts for performance
            await page.route('**/*.{png,jpg,jpeg,gif,svg,css,woff,woff2}', route => route.abort());
            return await checker(page, restaurant, query);
          } finally {
            await page.close();
          }
        }
        return { name: restaurant.name, status: 'error', reason: `No checker found for platform: ${restaurant.platform}` };
      });
      
      const batchResults = await Promise.allSettled(promises);
      
      batchResults.forEach(result => {
        if (result.status === 'fulfilled' && result.value) {
           if (result.value.status === 'available') {
             results.available.push(result.value);
           } else {
             results.unavailable.push(result.value);
           }
        } else if (result.status === 'rejected') {
            console.error('A checker promise was rejected:', result.reason);
        }
      });
    }
    
    // --- Cache-Aside Logic: Step 2 - Set Cache for future requests ---
    if (results.available.length > 0 || results.unavailable.length > 0) {
        await redis.set(cacheKey, JSON.stringify(results), { ex: CACHE_EXPIRATION_SECONDS });
        console.log('CACHE SET:', cacheKey);
    }

    response.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate');
    return response.status(200).json(results);

  } catch (error) {
    console.error('Unhandled error in serverless function:', error);
    return response.status(500).json({ 
        error: 'An internal server error occurred.',
        details: error.message 
    });
  } finally {
    if (browser !== null) {
      await browser.close();
    }
  }
}
