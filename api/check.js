// api/check.js
import { chromium } from 'playwright-core';
import chrome from 'chrome-aws-lambda';
import fs from 'fs';
import path from 'path';

// Dynamically import platform-specific checkers
import { checkSevenRooms } from '../checkers/sevenrooms.js';
// NOTE: We're assuming other checkers (chope, tablecheck, etc.) exist in the ../checkers/ directory.
// You would import them here as well.
// import { checkChope } from '../checkers/chope.js';
import { checkTableCheck } from '../checkers/tablecheck.js';
// import { checkBistrochat } from '../checkers/bistrochat.js';
import { checkResDiary } from '../checkers/resdiary.js';


const BATCH_SIZE = 5; // We can increase batch size in a serverless environment

// --- Helper function to get executable path ---
// This is important for running Chromium in different environments (local vs. Vercel)
async function getExecutablePath() {
  // if we are on Vercel, use the path provided by chrome-aws-lambda
  if (process.env.AWS_LAMBDA_FUNCTION_VERSION) {
    return chrome.executablePath;
  }
  // otherwise, use the default Playwright location
  return chromium.executablePath();
}

// Platform checker mapping
const platformCheckers = {
  sevenrooms: checkSevenRooms,
  // chope: checkChope,
  tablecheck: checkTableCheck,
  // bistrochat: checkBistrochat,
  resdiary: checkResDiary,
};

// Main serverless function handler
export default async function handler(req, res) {
  // --- CORS Headers ---
  // Allow requests from any origin for our UI
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );
  // Handle OPTIONS request for CORS preflight
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    // --- Extract and validate query parameters ---
    const { date, partySize, time } = req.query;
    if (!date || !partySize || !time) {
      return res.status(400).json({ error: 'Missing required query parameters: date, partySize, time' });
    }
    
    const query = { date, partySize, time };

    // --- Load restaurants data ---
    // Note: In Vercel, file paths need to be handled carefully.
    const jsonPath = path.join(process.cwd(), 'restaurants.json');
    const restaurants = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));

    // --- Launch Browser ---
    const executablePath = await getExecutablePath();
    const browser = await chromium.launch({
      args: chrome.args,
      executablePath,
      headless: true,
    });
    
    const results = { available: [], unavailable: [] };
    
    // --- Process restaurants in batches ---
    for (let i = 0; i < restaurants.length; i += BATCH_SIZE) {
        const batch = restaurants.slice(i, i + BATCH_SIZE);
        const promises = batch.map(r => checkRestaurant(browser, r, query));
        const batchResults = await Promise.all(promises);
        
        batchResults.forEach(result => {
            if (result && result.status === 'available') {
                results.available.push(result);
            } else if (result) {
                results.unavailable.push(result);
            }
        });
    }

    await browser.close();

    // --- Send Response ---
    res.status(200).json(results);

  } catch (error) {
    console.error('Error during availability check:', error);
    res.status(500).json({ error: 'An internal server error occurred.', details: error.message });
  }
}

// --- Individual Restaurant Checker ---
async function checkRestaurant(browser, restaurant, query) {
    const checker = platformCheckers[restaurant.platform];
    if (!checker) {
        console.warn(`Warning: No checker found for platform '${restaurant.platform}'`);
        return { name: restaurant.name, status: 'error', reason: 'No checker found', url: '#' };
    }
    
    let page;
    try {
        page = await browser.newPage();
        // Optimize page loading
        await page.route('**/*.{png,jpg,jpeg,gif,svg,css,woff2}', (route) => route.abort());
        await page.setExtraHTTPHeaders({
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/99.0.4844.84 Safari/537.36'
        });
        
        const result = await checker(page, restaurant, query);
        return result;
    } catch (e) {
        console.error(`Error checking ${restaurant.name}:`, e.message);
        return { name: restaurant.name, status: 'error', reason: e.message, url: '#' };
    } finally {
        if (page) {
            await page.close();
        }
    }
}
