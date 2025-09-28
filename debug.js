// debug.js - Test script to see what's happening on restaurant pages
import { chromium } from 'playwright';
import { checkSevenRooms } from './checkers/sevenrooms.js';
import { checkChope } from './checkers/chope.js';
import { checkTableCheck } from './checkers/tablecheck.js';
import { checkBistrochat } from './checkers/bistrochat.js';
import { checkResDiary } from './checkers/resdiary.js';

const platformCheckers = {
  sevenrooms: checkSevenRooms,
  chope: checkChope,
  tablecheck: checkTableCheck,
  bistrochat: checkBistrochat,
  resdiary: checkResDiary,
};

async function debugRestaurant(restaurant, query) {
  console.log(`\n🔍 Debugging: ${restaurant.name} (${restaurant.platform})`);
  console.log(`URL will be constructed for: ${query.date}, party: ${query.partySize}, time: ${query.time}`);
  
  const browser = await chromium.launch({ headless: false, slowMo: 1000 }); // Visible browser with delay
  const page = await browser.newPage();
  
  try {
    const checker = platformCheckers[restaurant.platform];
    if (!checker) {
      console.log(`❌ No checker found for platform: ${restaurant.platform}`);
      return;
    }
    
    // Construct the URL manually to show it
    let url = restaurant.url || 'URL will be constructed by checker';
    if (restaurant.platform === 'sevenrooms' && restaurant.url) {
      const urlObj = new URL(restaurant.url);
      urlObj.searchParams.set('date', query.date);
      urlObj.searchParams.set('time', query.time);
      urlObj.searchParams.set('party_size', query.partySize);
      url = urlObj.toString();
    } else if (restaurant.platform === 'chope' && restaurant.url && restaurant.url.includes('book.chope.co/booking')) {
      const [year, month, day] = query.date.split('-');
      const urlObj = new URL(restaurant.url);
      urlObj.searchParams.set('date', `${day}/${month}/${year}`);
      urlObj.searchParams.set('time', query.time.replace(':', ''));
      urlObj.searchParams.set('adults', query.partySize);
      url = urlObj.toString();
    }
    console.log(`🌐 Visiting: ${url}`);
    
    // Don't navigate here - let the checker handle it
    
    console.log(`🕐 Looking for time: ${query.time}`);
    
    // Run the checker
    const result = await checker(page, restaurant, query);
    console.log(`📊 Final Result: ${result.status}`);
    console.log(`🔗 URL: ${result.url}`);
    
    // Take a screenshot for debugging
    await page.screenshot({ path: `debug-${restaurant.slug}.png`, fullPage: true });
    console.log(`📸 Screenshot saved as: debug-${restaurant.slug}.png`);
    
    // Wait so you can see the page
    console.log('⏳ Page will stay open for 15 seconds for manual inspection...');
    await page.waitForTimeout(15000);
    
  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
  } finally {
    await browser.close();
  }
}

// Test with one restaurant - try a SevenRooms restaurant that showed as Not Available
const testRestaurant = { "name": "Carbone", "platform": "sevenrooms", "slug": "carbonehk", "url": "https://www.sevenrooms.com/reservations/blacksheep/bsrwebsite?venues=carbonehk" };
const testQuery = {
  date: '2025-09-27',
  partySize: '2',
  time: '19:00'
};

console.log('🚀 Starting debug session...');
debugRestaurant(testRestaurant, testQuery);
