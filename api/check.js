// api/check.js
import { Redis } from '@upstash/redis';
import playwright from 'playwright-core';
import chromium from '@sparticuz/chromium';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Import all the checker functions
import { check as checkChope } from '../checkers/chope.js';
import { checkSevenRooms } from '../checkers/sevenrooms.js';
import { checkTableCheck } from '../checkers/tablecheck.js';
import { checkResDiary } from '../checkers/resdiary.js';
import { checkBistrochat } from '../checkers/bistrochat.js';

// --- Caching Setup ---
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

const BATCH_SIZE = 5; 
const CACHE_EXPIRATION_SECONDS = 300; // 5 minutes

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

    const cacheKey = `reservations:${date}:${partySize}:${time}`;
    const cachedResults = await redis.get(cacheKey);

    if (cachedResults) {
      console.log('CACHE HIT:', cacheKey);
      response.setHeader('X-Cache-Status', 'HIT');
      return response.status(200).json(cachedResults);
    }

    console.log('CACHE MISS:', cacheKey);
    response.setHeader('X-Cache-Status', 'MISS');
    
    // --- Load restaurant data from local JSON file ---
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const jsonPath = path.join(__dirname, '..', 'restaurants.json');
    const restaurants = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));

    // --- Launch Serverless-Compatible Browser ---
    browser = await playwright.chromium.launch({
        args: chromium.args,
        executablePath: await chromium.executablePath(),
        headless: chromium.headless,
        ignoreHTTPSErrors: true,
    });

    const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    });

    const results = { available: [], unavailable: [], generatedAt: new Date().toISOString() };

    // --- Process restaurants in batches ---
    for (let i = 0; i < restaurants.length; i += BATCH_SIZE) {
      const batch = restaurants.slice(i, i + BATCH_SIZE);
      const promises = batch.map(async (restaurant) => {
        const checker = platformCheckers[restaurant.platform];
        if (checker) {
          const page = await context.newPage();
          page.setDefaultNavigationTimeout(45000); // 45 seconds
          try {
            return await checker(page, query, restaurant);
          } finally {
            await page.close();
          }
        }
        return { status: 'skipped', name: restaurant.name, url: restaurant.url };
      });
      
      const batchResults = await Promise.allSettled(promises);

      batchResults.forEach(result => {
        if (result.status === 'fulfilled' && result.value.status !== 'skipped') {
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
    
    // --- Set cache for future requests ---
    if (results.available.length > 0 || results.unavailable.length > 0) {
        await redis.set(cacheKey, JSON.stringify(results), { ex: CACHE_EXPIRATION_SECONDS });
        console.log('CACHE SET:', cacheKey);
    }

    return response.status(200).json(results);

  } catch (error) {
    console.error('Unhandled error in serverless function:', error);
    return response.status(500).json({ 
        error: 'An internal server error occurred.',
        details: error.message 
    });
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

