// checkers/sevenrooms.js
import { getPageText, safeGoto } from './utils.js';

export async function checkSevenRooms(page, restaurant, query) {
  // Use the full URL if provided, otherwise construct from slug
  let url;
  if (restaurant.url) {
    // Add query parameters to existing URL
    const urlObj = new URL(restaurant.url);
    urlObj.searchParams.set('date', query.date);
    urlObj.searchParams.set('time', query.time);
    urlObj.searchParams.set('party_size', query.partySize);
    url = urlObj.toString();
  } else {
    url = `https://www.sevenrooms.com/reservations/${restaurant.slug}?date=${query.date}&time=${query.time}&party_size=${query.partySize}`;
  }
  try {
    // Use a more reliable wait strategy and longer timeout
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
    
    // Wait for dynamic content to load
    await page.waitForTimeout(5000);
    
    // Check for multiple possible "no availability" indicators
    const noTimesSelector = 'div[data-testid="no-times-available-message"]';
    const noAvailabilityText = 'No times available';
    const fullyBookedText = 'fully booked';
    const noTimesText = 'no times available';
    
    // First check for the specific selector
    const noTimesElement = await page.$(noTimesSelector);
    if (noTimesElement) {
      return { name: restaurant.name, status: 'unavailable', url };
    }
    
    // Then check page content for various unavailability messages
    const content = await getPageText(page);
    const contentLower = content.toLowerCase();
    
    // Check for explicit "no availability" messages
    const unavailabilityMessages = [
      'there is no availability that meets your search criteria',
      'no availability that meets your search criteria',
      'no times available',
      'fully booked',
      'no availability',
      'not available for this date',
      'no tables available',
      'sold out'
    ];
    
    for (const message of unavailabilityMessages) {
      if (contentLower.includes(message)) {
        return { name: restaurant.name, status: 'unavailable', url };
      }
    }
    
    // Look for positive indicators of availability
    // 1. Check for "Experiences Available" text (common on SevenRooms)
    if (contentLower.includes('experiences available') || contentLower.includes('experience available')) {
      return { name: restaurant.name, status: 'available', url };
    }
    
    // 2. Look for time slots in the page content (more reliable than DOM selectors)
    const timePatterns = [
      /\b\d{1,2}:\d{2}\s*(am|pm)\b/gi, // "7:00 pm", "12:30 am"
      /\b\d{1,2}:\d{2}\b/g, // "19:00", "12:30"
      /\b(lunch|dinner)\b/gi // "Lunch", "Dinner"
    ];
    
    let timeSlotCount = 0;
    for (const pattern of timePatterns) {
      const matches = content.match(pattern);
      if (matches) {
        timeSlotCount += matches.length;
      }
    }
    
    // If we found multiple time references, likely has availability
    if (timeSlotCount >= 3) {
      return { name: restaurant.name, status: 'available', url };
    }
    
    // 3. Look for actual time slot elements
    const timeSlotElements = await page.$$('button, a, div, span');
    let foundTimeSlots = 0;
    
    for (const element of timeSlotElements.slice(0, 100)) { // Check first 100 elements
      try {
        const text = await element.textContent();
        if (text && (text.match(/\d{1,2}:\d{2}/) || text.match(/\d{1,2}(am|pm)/i))) {
          foundTimeSlots++;
          if (foundTimeSlots >= 3) {
            return { name: restaurant.name, status: 'available', url };
          }
        }
      } catch (e) {
        // Skip elements that can't be accessed
      }
    }
    
    // 4. Look for booking-related text in content
    const bookingKeywords = [
      'view details',
      'book now',
      'reserve now', 
      'make reservation',
      'find availability',
      'select time',
      'choose time',
      'available times'
    ];
    
    for (const keyword of bookingKeywords) {
      if (contentLower.includes(keyword)) {
        return { name: restaurant.name, status: 'available', url };
      }
    }
    
    // 5. Look for booking buttons with more flexible selectors
    const allButtons = await page.$$('button, a, input[type="submit"]');
    for (const button of allButtons.slice(0, 50)) {
      try {
        const buttonText = await button.textContent();
        if (buttonText) {
          const lowerButtonText = buttonText.toLowerCase();
          if (lowerButtonText.includes('book') || 
              lowerButtonText.includes('reserve') || 
              lowerButtonText.includes('view details') ||
              lowerButtonText.includes('select') ||
              lowerButtonText.includes('available')) {
            const isVisible = await button.isVisible();
            if (isVisible) {
              return { name: restaurant.name, status: 'available', url };
            }
          }
        }
      } catch (e) {
        // Skip elements that can't be accessed
      }
    }
    
    // Default to unavailable if we can't find positive indicators of availability
    // This is more conservative but reduces false positives
    return { name: restaurant.name, status: 'unavailable', url };
    
  } catch (error) {
    console.error(`SevenRooms error for ${restaurant.name}:`, error.message);
    return { name: restaurant.name, status: 'error', url };
  }
}
