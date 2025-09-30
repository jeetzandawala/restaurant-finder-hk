// checkers/tablecheck.js
import { getPageText, safeGoto } from './utils.js';

export async function checkTableCheck(page, restaurant, query) {
  const url = restaurant.url || `https://www.tablecheck.com/en/${restaurant.slug}/reserve`;
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
      'no slots available'
    ];
    
    for (const message of unavailableMessages) {
      if (contentLower.includes(message)) {
        return { name: restaurant.name, status: 'unavailable', url };
      }
    }
    
    // Look for time slots in the page content
    const timePatterns = [
      /\b\d{1,2}:\d{2}\s*(am|pm)\b/gi, // "7:00 pm", "12:30 am"
      /\b\d{1,2}:\d{2}\b/g, // "19:00", "12:30"
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
    
    // Look for booking-related keywords
    const bookingKeywords = [
      'find availability',
      'select a time',
      'choose time',
      'available times',
      'book now',
      'reserve now'
    ];
    
    for (const keyword of bookingKeywords) {
      if (contentLower.includes(keyword)) {
        return { name: restaurant.name, status: 'available', url };
      }
    }
    
    // Look for time slot elements more broadly
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
        // Skip elements that can't be accessed
      }
    }
    
    // Look for booking buttons with flexible text matching
    const allButtons = await page.$$('button, input[type="submit"], a');
    for (const button of allButtons.slice(0, 50)) {
      try {
        const buttonText = await button.textContent();
        if (buttonText) {
          const lowerText = buttonText.toLowerCase();
          if (lowerText.includes('book') || 
              lowerText.includes('reserve') ||
              lowerText.includes('find availability') ||
              lowerText.includes('select')) {
            return { name: restaurant.name, status: 'available', url };
          }
        }
      } catch (e) {
        // Skip
      }
    }
    
    // Check for forms (booking forms indicate availability)
    const forms = await page.$$('form');
    if (forms.length >= 1) {
      return { name: restaurant.name, status: 'available', url };
    }
    
    // If page has reasonable structure but no explicit unavailability, assume available
    const pageStructure = {
      buttons: allButtons.length,
      links: (await page.$$('a')).length,
      forms: forms.length
    };
    
    // If page has interactive elements and no unavailability messages, likely available
    if (pageStructure.buttons > 5 || pageStructure.links > 10) {
      return { name: restaurant.name, status: 'available', url };
    }
    
    // Default to unavailable if we can't find positive indicators of availability
    return { name: restaurant.name, status: 'unavailable', url };
    
  } catch (error) {
    console.error(`TableCheck error for ${restaurant.name}:`, error.message);
    return { name: restaurant.name, status: 'unavailable', url };
  }
}
