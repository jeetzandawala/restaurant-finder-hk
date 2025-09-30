// checkers/chope.js
import { getPageText, getElementText, safeGoto, safeQuery } from './utils.js';

export async function checkChope(page, restaurant, query) {
  const [year, month, day] = query.date.split('-');
  
  let url;
  if (restaurant.url && restaurant.url.includes('book.chope.co/booking')) {
    // Use existing Chope booking URL and add parameters
    const urlObj = new URL(restaurant.url);
    urlObj.searchParams.set('date', `${day}/${month}/${year}`);
    urlObj.searchParams.set('time', query.time.replace(':', ''));
    urlObj.searchParams.set('adults', query.partySize);
    url = urlObj.toString();
  } else if (restaurant.url) {
    // For other Chope URLs, try to use as-is
    url = restaurant.url;
  } else {
    // Construct from slug
    url = `https://book.chope.co/booking?rid=${restaurant.slug}&source=rest_website&date=${day}%2F${month}%2F${year}&time=${query.time.replace(':', '')}&adults=${query.partySize}`;
  }
  try {
    const navigationSuccess = await safeGoto(page, url);
    if (!navigationSuccess) {
      return { name: restaurant.name, status: 'unavailable', url };
    }
    
    // Wait for dynamic content to load
    await page.waitForTimeout(3000);
    
    // Get page content
    const content = await getPageText(page);
    const contentLower = content.toLowerCase();
    
    // Check for various unavailability messages
    const unavailableMessages = [
      'there are no available timeslots',
      'no available timeslots',
      'fully booked',
      'no availability',
      'not available',
      'no tables available',
      'sold out'
    ];
    
    for (const message of unavailableMessages) {
      if (contentLower.includes(message)) {
        return { name: restaurant.name, status: 'unavailable', url };
      }
    }
    
    // Look for booking-related elements that indicate availability
    const bookingElements = await safeQuery(page, 'button[type="submit"], .book-now, .reserve-now, .available-slot, input[type="submit"]');
    if (bookingElements.length > 0) {
      // Check if any of these elements contain booking-related text
      for (const element of bookingElements) {
        const elementText = await getElementText(element);
        if (elementText && (
          elementText.toLowerCase().includes('book') || 
          elementText.toLowerCase().includes('reserve') ||
          elementText.toLowerCase().includes('confirm')
        )) {
          return { name: restaurant.name, status: 'available', url };
        }
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
    
    // Look for Chope-specific availability indicators
    const chopeKeywords = [
      'available timeslots',
      'select time',
      'choose time',
      'book now',
      'reserve now',
      'make reservation'
    ];
    
    for (const keyword of chopeKeywords) {
      if (contentLower.includes(keyword)) {
        return { name: restaurant.name, status: 'available', url };
      }
    }
    
    // Also check all clickable elements for time patterns
    const allClickableElements = await safeQuery(page, 'button, a, option, .clickable, [role="button"]');
    for (const element of allClickableElements) {
      const elementText = await getElementText(element);
      if (elementText && (elementText.match(/\d{1,2}:\d{2}/) || elementText.match(/\d{1,2}(am|pm)/i))) {
        return { name: restaurant.name, status: 'available', url };
      }
    }
    
    // Check for restaurant selection or calendar elements (indicates working booking system)
    const functionalElements = await safeQuery(page, 'select, .calendar, .date-picker, form');
    if (functionalElements.length > 2) { // More than just basic page elements
      return { name: restaurant.name, status: 'available', url };
    }
    
    // Check for forms (booking forms indicate availability)
    const forms = await safeQuery(page, 'form');
    if (forms.length >= 1) {
      return { name: restaurant.name, status: 'available', url };
    }
    
    // Check page structure - if it has many interactive elements, likely available
    const buttons = await safeQuery(page, 'button');
    const links = await safeQuery(page, 'a');
    
    // Chope pages with booking capability have many interactive elements
    if (buttons.length > 10 || links.length > 50) {
      return { name: restaurant.name, status: 'available', url };
    }
    
    // Default to unavailable if we can't find positive indicators of availability
    return { name: restaurant.name, status: 'unavailable', url };
    
  } catch (error) {
    console.error(`Chope error for ${restaurant.name}:`, error.message);
    return { name: restaurant.name, status: 'unavailable', url };
  }
}
