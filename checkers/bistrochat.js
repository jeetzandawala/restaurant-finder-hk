// checkers/bistrochat.js
import { getPageText, safeGoto } from './utils.js';

export async function checkBistrochat(page, restaurant, query) {
  const url = restaurant.url || `https://book.bistrochat.com/${restaurant.slug}`;
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
    
    // Look for time slots in the page content (Bistrochat shows many time options)
    const timePatterns = [
      /\b\d{1,2}:\d{2}\b/g, // "19:00", "12:30"
      /\b\d{1,2}:\d{2}\s*(am|pm)\b/gi, // "7:00 pm"
    ];
    
    let timeSlotCount = 0;
    for (const pattern of timePatterns) {
      const matches = content.match(pattern);
      if (matches) {
        timeSlotCount += matches.length;
      }
    }
    
    // Bistrochat typically shows many time slots when available
    if (timeSlotCount >= 5) {
      return { name: restaurant.name, status: 'available', url };
    }
    
    // Look for Bistrochat-specific booking keywords
    const bookingKeywords = [
      'book now',
      'reserve now',
      'how many of you',
      'when would you like',
      'what time would',
      'join us',
      'book a table'
    ];
    
    for (const keyword of bookingKeywords) {
      if (contentLower.includes(keyword)) {
        return { name: restaurant.name, status: 'available', url };
      }
    }
    
    // Look for time elements in DOM (Bistrochat has many time buttons)
    const allElements = await page.$$('button, div, span');
    let foundTimeElements = 0;
    
    for (const element of allElements.slice(0, 100)) {
      try {
        const text = await element.textContent();
        if (text && text.match(/^\d{1,2}:\d{2}$/)) { // Exact time format like "19:00"
          foundTimeElements++;
          if (foundTimeElements >= 5) {
            return { name: restaurant.name, status: 'available', url };
          }
        }
      } catch (e) {
        // Skip
      }
    }
    
    // Look for booking buttons
    const allButtons = await page.$$('button, input[type="submit"]');
    for (const button of allButtons.slice(0, 30)) {
      try {
        const buttonText = await button.textContent();
        if (buttonText) {
          const lowerText = buttonText.toLowerCase();
          if (lowerText.includes('book') || 
              lowerText.includes('reserve') ||
              lowerText.includes('table')) {
            return { name: restaurant.name, status: 'available', url };
          }
        }
      } catch (e) {
        // Skip
      }
    }
    
    // Bistrochat seems to work reliably, so assume available if no explicit unavailability
    return { name: restaurant.name, status: 'available', url };
    
  } catch (error) {
    console.error(`Bistrochat error for ${restaurant.name}:`, error.message);
    return { name: restaurant.name, status: 'unavailable', url };
  }
}
