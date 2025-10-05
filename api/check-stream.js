// api/check-stream.js - Ultra-fast streaming API with real-time updates
import { Redis } from '@upstash/redis';
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

// Import existing checkers
import { checkChope } from '../checkers/chope.js';
import { checkSevenRooms } from '../checkers/sevenrooms.js';
import { checkTableCheck } from '../checkers/tablecheck.js';
import { checkResDiary } from '../checkers/resdiary.js';
import { checkBistrochat } from '../checkers/bistrochat.js';

const CACHE_EXPIRATION_SECONDS = 1800; // 30 minutes
const MAX_CONCURRENT_PAGES = 15; // Optimized for speed

const platformCheckers = {
  sevenrooms: checkSevenRooms,
  tablecheck: checkTableCheck,
  resdiary: checkResDiary,
  chope: checkChope,
  bistrochat: checkBistrochat,
};

// Lightweight browser pool
class FastBrowserPool {
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
        '--disable-web-security',
        '--disable-features=IsolateOrigins,site-per-process',
        '--memory-pressure-off',
      ]
    });
  }

  async getPage() {
    if (this.pages.length > 0) {
      return this.pages.pop();
    }
    
    const page = await this.browser.newPage();
    await page.setExtraHTTPHeaders({
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
    });
    page.setDefaultNavigationTimeout(15000); // Faster timeout
    
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
    await Promise.all(this.pages.map(page => page.close().catch(() => {})));
    this.pages = [];
    if (this.browser) {
      await this.browser.close();
    }
  }
}

// Cache helper
async function getFromCache(redis, cacheKey) {
  if (!redis) return null;
  
  try {
    const cached = await redis.get(cacheKey);
    if (cached && typeof cached === 'string') {
      const data = JSON.parse(cached);
      if (data && data.generatedAt) {
        const cacheAge = Date.now() - new Date(data.generatedAt).getTime();
        if (cacheAge < CACHE_EXPIRATION_SECONDS * 1000) {
          return data;
        }
      }
    }
  } catch (error) {
    console.warn('Cache error:', error.message);
  }
  
  return null;
}

// Stream results as they come in
async function processRestaurantsStreaming(browserPool, restaurants, query, sendUpdate) {
  const semaphore = Array(MAX_CONCURRENT_PAGES).fill(null);
  let index = 0;
  let completed = 0;
  const total = restaurants.length;
  
  const results = {
    available: [],
    unavailable: []
  };

  const processNext = async () => {
    const currentIndex = index++;
    if (currentIndex >= restaurants.length) return;
    
    const restaurant = restaurants[currentIndex];
    const checker = platformCheckers[restaurant.platform];
    
    if (!checker) {
      completed++;
      sendUpdate({
        type: 'progress',
        restaurant: restaurant.name,
        status: 'skipped',
        completed,
        total
      });
      await processNext();
      return;
    }

    let page = null;
    try {
      page = await browserPool.getPage();
      
      // Send checking update
      sendUpdate({
        type: 'checking',
        restaurant: restaurant.name,
        completed,
        total
      });
      
      // Check with faster timeout
      const result = await Promise.race([
        checker(page, restaurant, query),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Timeout')), 30000) // 30s timeout
        )
      ]);
      
      completed++;
      
      if (result.status === 'available') {
        results.available.push(result);
        // Send immediate result update
        sendUpdate({
          type: 'result',
          result,
          completed,
          total
        });
      } else {
        results.unavailable.push(result);
      }
      
      // Send progress update
      sendUpdate({
        type: 'progress',
        restaurant: restaurant.name,
        status: result.status,
        completed,
        total
      });
      
    } catch (error) {
      completed++;
      results.unavailable.push({ 
        status: 'unavailable', 
        name: restaurant.name, 
        url: restaurant.url,
        reason: 'error'
      });
      
      sendUpdate({
        type: 'progress',
        restaurant: restaurant.name,
        status: 'error',
        completed,
        total
      });
    } finally {
      if (page) {
        await browserPool.releasePage(page);
      }
    }
    
    await processNext();
  };

  // Start concurrent processing
  await Promise.all(semaphore.map(() => processNext()));
  return results;
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

    const cacheKey = `stream:${date}:${partySize}:${time}`;
    
    // Check cache first
    const cachedData = await getFromCache(redis, cacheKey);
    if (cachedData) {
      response.setHeader('X-Cache-Status', 'HIT');
      return response.status(200).json(cachedData);
    }

    // Set up SSE (Server-Sent Events) headers
    response.setHeader('Content-Type', 'text/event-stream');
    response.setHeader('Cache-Control', 'no-cache');
    response.setHeader('Connection', 'keep-alive');
    response.setHeader('X-Cache-Status', 'MISS');

    // Load restaurants
    const jsonPath = path.join(process.cwd(), 'restaurants.json');
    const restaurants = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));

    // Send initial status
    const sendUpdate = (data) => {
      response.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    sendUpdate({
      type: 'start',
      totalRestaurants: restaurants.length,
      message: 'Starting search...'
    });

    // Initialize browser pool
    browserPool = new FastBrowserPool();
    await browserPool.initialize();

    sendUpdate({
      type: 'status',
      message: 'Browser initialized, checking restaurants...'
    });

    // Process restaurants with streaming updates
    const results = await processRestaurantsStreaming(browserPool, restaurants, { date, partySize, time }, sendUpdate);

    // Send final results
    const finalData = {
      ...results,
      generatedAt: new Date().toISOString(),
      totalRestaurants: restaurants.length
    };

    sendUpdate({
      type: 'complete',
      data: finalData
    });

    // Cache results
    if (redis && finalData.totalRestaurants > 0) {
      try {
        await redis.set(cacheKey, JSON.stringify(finalData), { ex: CACHE_EXPIRATION_SECONDS });
      } catch (error) {
        console.warn('Cache write error:', error.message);
      }
    }

    response.end();

  } catch (error) {
    console.error('Handler error:', error);
    try {
      response.write(`data: ${JSON.stringify({
        type: 'error',
        error: error.message
      })}\n\n`);
    } catch {}
    response.end();
  } finally {
    if (browserPool) {
      await browserPool.cleanup();
    }
  }
}
