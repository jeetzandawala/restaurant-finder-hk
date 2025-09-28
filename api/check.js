// api/check.js
import playwright from 'playwright-core';
// --- CHANGE 1: Import the new chromium package ---
import chromium from '@sparticuz/chromium';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Import our platform-specific checkers
import { checkSevenRooms } from '../checkers/sevenrooms.js';
import { checkTableCheck } from '../checkers/tablecheck.js';
import { checkResDiary } from '../checkers/resdiary.js';

const BATCH_SIZE = 3;

const platformCheckers = {
  sevenrooms: checkSevenRooms,
  tablecheck: checkTableCheck,
  resdiary: checkResDiary,
};

export default async function handler(request, response) {
  let browser = null;
  try {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const jsonPath = path.join(__dirname, '..', 'restaurants.json');
    const restaurants = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));

    const { date, partySize, time } = request.query;
    if (!date || !partySize || !time) {
      return response.status(400).json({ error: 'Missing required query parameters: date, partySize, time' });
    }
    const query = { date, partySize, time };

    // --- CHANGE 2: Launch the browser using the new package's settings ---
    browser = await playwright.chromium.launch({
      args: chromium.args,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
      ignoreHTTPSErrors: true, // Helpful in serverless environments
    });
    
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    });

    const results = { available: [], unavailable: [] };

    for (let i = 0; i < restaurants.length; i += BATCH_SIZE) {
      const batch = restaurants.slice(i, i + BATCH_SIZE);
      const promises = batch.map(async (restaurant) => {
        const checker = platformCheckers[restaurant.platform];
        if (checker) {
          const page = await context.newPage();
          try {
            page.setDefaultNavigationTimeout(45000); 
            return await checker(page, restaurant, query);
          } finally {
            await page.close();
          }
        }
        return { name: restaurant.name, status: 'error', reason: 'No checker found for this platform' };
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

