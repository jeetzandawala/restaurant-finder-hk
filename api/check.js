// api/check.js
import playwright from 'playwright-core';
import chrome from 'chrome-aws-lambda';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Import our platform-specific checkers
// Note the path change: we are now in api/, so we go up and then into checkers/
import { checkSevenRooms } from '../checkers/sevenrooms.js';
import { checkTableCheck } from '../checkers/tablecheck.js';
import { checkResDiary } from '../checkers/resdiary.js';
// Add other checkers like 'chope' here when you create the file

const BATCH_SIZE = 3; // Keep batch size small to avoid timeouts in serverless environment

// Platform checker mapping
const platformCheckers = {
  sevenrooms: checkSevenRooms,
  tablecheck: checkTableCheck,
  resdiary: checkResDiary,
};

// Main serverless function handler
export default async function handler(request, response) {
  try {
    // --- FIX 1: Correctly locate and read restaurants.json ---
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    // The path is relative to this file (api/check.js), so we go up one level to the root
    const jsonPath = path.join(__dirname, '..', 'restaurants.json');
    const restaurants = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));

    // Extract query parameters from the request URL
    const { date, partySize, time } = request.query;
    if (!date || !partySize || !time) {
      return response.status(400).json({ error: 'Missing required query parameters: date, partySize, time' });
    }
    const query = { date, partySize, time };

    // --- FIX 2: Launch browser correctly for the serverless environment ---
    const browser = await playwright.chromium.launch({
      args: chrome.args,
      executablePath: await chrome.executablePath,
      headless: chrome.headless,
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
            // Add a specific timeout for each page navigation
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

    await browser.close();

    // Add caching headers to speed up repeated identical searches
    response.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate'); 
    return response.status(200).json(results);

  } catch (error) {
    // If anything goes wrong, log it for debugging and send a clean error response
    console.error('Unhandled error in serverless function:', error);
    return response.status(500).json({ 
        error: 'An internal server error occurred.',
        details: error.message 
    });
  }
}