// checkers/resdiary.js
import { getPageText, safeGoto } from './utils.js';

export async function checkResDiary(page, restaurant, query) {
  const url = restaurant.url;
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
    
    // Wait for dynamic content to load
    await page.waitForTimeout(5000);
    
    // Get page content
    const content = await getPageText(page);
    const contentLower = content.toLowerCase();
    
    // Check for various unavailability messages
    const unavailableMessages = [
      'no available slots',
      'no availability',
      'fully booked',
      'not available',
      'no tables available',
      'sold out',
      'no reservations available',
      'restaurant is closed',
      'booking not available'
    ];
    
    for (const message of unavailableMessages) {
      if (contentLower.includes(message)) {
        return { name: restaurant.name, status: 'unavailable', url };
      }
    }
    
    // Look for time slots in content
    const timePatterns = [
      /\b\d{1,2}:\d{2}\s*(am|pm)\b/gi,
      /\b\d{1,2}:\d{2}\b/g,
    ];
    
    let timeSlotCount = 0;
    for (const pattern of timePatterns) {
      const matches = content.match(pattern);
      if (matches) {
        timeSlotCount += matches.length;
      }
    }
    
    if (timeSlotCount >= 3) {
      return { name: restaurant.name, status: 'available', url };
    }
    
    // Look for ResDiary-specific availability indicators
    const resdiaryKeywords = [
      'book now',
      'reserve now',
      'make reservation',
      'select time',
      'available times',
      'choose date'
    ];
    
    for (const keyword of resdiaryKeywords) {
      if (contentLower.includes(keyword)) {
        return { name: restaurant.name, status: 'available', url };
      }
    }
    
    // Look for time elements in DOM
    const allElements = await page.$$('button, a, div, span');
    let foundTimeElements = 0;
    
    for (const element of allElements.slice(0, 100)) {
      try {
        const text = await element.textContent();
        if (text && (text.match(/\d{1,2}:\d{2}/) || text.match(/\d{1,2}(am|pm)/i))) {
          foundTimeElements++;
          if (foundTimeElements >= 3) {
            return { name: restaurant.name, status: 'available', url };
          }
        }
      } catch (e) {
        // Skip
      }
    }
    
    // Look for booking buttons
    const allButtons = await page.$$('button, input[type="submit"], form');
    if (allButtons.length >= 2) {
      return { name: restaurant.name, status: 'available', url };
    }
    
    // Default to unavailable if we can't find positive indicators of availability
    return { name: restaurant.name, status: 'unavailable', url };
    
  } catch (error) {
    console.error(`ResDiary error for ${restaurant.name}:`, error.message);
    return { name: restaurant.name, status: 'unavailable', url };
  }
}
