// api/check.js - Simplified high-performance version
import { Redis } from '@upstash/redis';
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

// Import existing checkers (no changes needed)
import { checkChope } from '../checkers/chope.js';
import { checkSevenRooms } from '../checkers/sevenrooms.js';
import { checkTableCheck } from '../checkers/tablecheck.js';
import { checkResDiary } from '../checkers/resdiary.js';
import { checkBistrochat } from '../checkers/bistrochat.js';

const BATCH_SIZE = 6; // Reduced for Railway memory constraints
const CACHE_EXPIRATION_SECONDS = 600; // 10 minutes (increased from 5)
const MAX_CONCURRENT_PAGES = 3; // Reduced concurrent pages for Railway

const platformCheckers = {
  sevenrooms: checkSevenRooms,
  tablecheck: checkTableCheck,
  resdiary: checkResDiary,
  chope: checkChope,
  bistrochat: checkBistrochat,
};

// Simple browser pool
class SimpleBrowserPool {
  constructor() {
    this.browser = null;
    this.pages = [];
  }

  async initialize() {
    this.browser = await chromium.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--single-process', // Critical for Railway - prevents crashes
        '--disable-background-networking',
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding',
        '--disable-features=TranslateUI',
        '--disable-ipc-flooding-protection',
        '--disable-extensions',
        '--disable-plugins',
        '--memory-pressure-off',
        '--max_old_space_size=256' // Limit memory usage
      ]
    });
  }

  async getPage() {
    if (this.pages.length > 0) {
      return this.pages.pop();
    }
    
    const page = await this.browser.newPage();
    await page.setExtraHTTPHeaders({
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    });
    page.setDefaultNavigationTimeout(20000);
    
    return page;
  }

  async releasePage(page) {
    try {
      await page.goto('about:blank');
      if (this.pages.length < MAX_CONCURRENT_PAGES) {
        this.pages.push(page);
      } else {
        await page.close();
      }
    } catch (error) {
      try { await page.close(); } catch {}
    }
  }

  async cleanup() {
    // Close all pages
    await Promise.all(this.pages.map(page => page.close().catch(() => {})));
    this.pages = [];
    
    // Close browser
    if (this.browser) {
      await this.browser.close();
    }
  }
}

// Smart caching with longer TTL
async function getFromCache(redis, cacheKey) {
  if (!redis) return null;
  
  try {
    const cached = await redis.get(cacheKey);
    if (cached) {
      const data = JSON.parse(cached);
      // Check if cache is less than 10 minutes old
      const cacheAge = Date.now() - new Date(data.generatedAt).getTime();
      if (cacheAge < CACHE_EXPIRATION_SECONDS * 1000) {
        return data;
      }
    }
  } catch (error) {
    console.warn('Cache read error:', error.message);
  }
  
  return null;
}

// Batch processing with concurrency control
async function processRestaurantBatch(browserPool, restaurants, query) {
  const semaphore = Array(MAX_CONCURRENT_PAGES).fill(null);
  let index = 0;
  const results = [];

  const processNext = async () => {
    const currentIndex = index++;
    if (currentIndex >= restaurants.length) return;
    
    const restaurant = restaurants[currentIndex];
    const checker = platformCheckers[restaurant.platform];
    
    if (!checker) {
      results[currentIndex] = { status: 'skipped', name: restaurant.name, url: restaurant.url };
      await processNext();
      return;
    }

    let page = null;
    try {
      page = await browserPool.getPage();
      
      // Add timeout and retry logic for Railway
      const result = await Promise.race([
        checker(page, restaurant, query),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Timeout after 30 seconds')), 30000)
        )
      ]);
      
      results[currentIndex] = result;
    } catch (error) {
      console.error(`Error checking ${restaurant.name}:`, error.message);
      
      // If page crashed, try to restart browser pool
      if (error.message.includes('crashed') || error.message.includes('Target closed')) {
        console.log(`Page crashed for ${restaurant.name}, will retry with new browser instance`);
      }
      
      results[currentIndex] = { 
        status: 'unavailable', 
        name: restaurant.name, 
        url: restaurant.url 
      };
    } finally {
      if (page) {
        try {
          await browserPool.releasePage(page);
        } catch (releaseError) {
          console.warn(`Error releasing page for ${restaurant.name}:`, releaseError.message);
        }
      }
    }
    
    await processNext();
  };

  // Start concurrent processing
  await Promise.all(semaphore.map(() => processNext()));
  return results.filter(Boolean);
}

export default async function handler(request, response) {
  let browserPool = null;
  let redis = null;
  
  try {
    const { date, partySize, time } = request.query;
    if (!date || !partySize || !time) {
      return response.status(400).json({ 
        error: 'Missing required parameters: date, partySize, time' 
      });
    }

    // Initialize Redis (optional)
    if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
      redis = new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL,
        token: process.env.UPSTASH_REDIS_REST_TOKEN,
      });
    }

    const cacheKey = `simple:${date}:${partySize}:${time}`;
    
    // Check cache first
    const cachedData = await getFromCache(redis, cacheKey);
    if (cachedData) {
      response.setHeader('X-Cache-Status', 'HIT');
      response.setHeader('X-Performance', 'Cached');
      return response.status(200).json(cachedData);
    }

    // Load restaurants
    const jsonPath = path.join(process.cwd(), 'restaurants.json');
    const restaurants = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));

    // Initialize browser pool
    browserPool = new SimpleBrowserPool();
    await browserPool.initialize();

    const results = { 
      available: [], 
      unavailable: [], 
      generatedAt: new Date().toISOString(),
      totalRestaurants: restaurants.length
    };

    // Process in larger batches for better performance
    console.log(`Processing ${restaurants.length} restaurants in batches of ${BATCH_SIZE}...`);
    
    for (let i = 0; i < restaurants.length; i += BATCH_SIZE) {
      const batch = restaurants.slice(i, i + BATCH_SIZE);
      const batchResults = await processRestaurantBatch(browserPool, batch, { date, partySize, time });
      
      batchResults.forEach(result => {
        if (result.status === 'available') {
          results.available.push(result);
        } else if (result.status === 'unavailable') {
          results.unavailable.push(result);
        }
      });
    }

    // Cache results
    if (redis) {
      try {
        await redis.set(cacheKey, JSON.stringify(results), { ex: CACHE_EXPIRATION_SECONDS });
      } catch (error) {
        console.warn('Cache write error:', error.message);
      }
    }

    response.setHeader('X-Cache-Status', 'MISS');
    response.setHeader('X-Performance', 'Fresh');
    response.setHeader('X-Available-Count', results.available.length);
    
    return response.status(200).json(results);

  } catch (error) {
    console.error('Handler error:', error);
    return response.status(500).json({
      error: 'Internal server error',
      details: error.message
    });
  } finally {
    if (browserPool) {
      await browserPool.cleanup();
    }
  }
}