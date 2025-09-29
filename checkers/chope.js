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
    
    // Look for the SPECIFIC time slot requested
    const requestedTime = query.time; // e.g., "19:00"
    const timeVariants = [
      requestedTime, // "19:00"
      requestedTime.replace(':', ''), // "1900"
      requestedTime.substring(0, 5), // "19:00"
      requestedTime.replace(':', '.'), // "19.00"
      `${requestedTime}:00`, // "19:00:00"
    ];
    
    // Check if our specific requested time appears in the page content or elements
    for (const timeVariant of timeVariants) {
      if (contentLower.includes(timeVariant.toLowerCase())) {
        // Found the time in content, check for selectable elements
        const timeElements = await safeQuery(page, `button, option, .time-slot`);
        if (timeElements.length > 0) {
          return { name: restaurant.name, status: 'available', url };
        }
      }
    }
    
    // Also check all clickable elements for the specific time
    const allClickableElements = await safeQuery(page, 'button, a, option, .clickable, [role="button"]');
    for (const element of allClickableElements) {
      const elementText = await getElementText(element);
      if (elementText && timeVariants.some(variant => elementText.includes(variant))) {
        return { name: restaurant.name, status: 'available', url };
      }
    }
    
    // Check for restaurant selection or calendar elements (indicates working booking system)
    const functionalElements = await safeQuery(page, 'select, .calendar, .date-picker, form');
    if (functionalElements.length > 2) { // More than just basic page elements
      return { name: restaurant.name, status: 'available', url };
    }
    
    // Default to unavailable if we can't find positive indicators of availability
    return { name: restaurant.name, status: 'unavailable', url };
    
  } catch (error) {
    console.error(`Chope error for ${restaurant.name}:`, error.message);
    return { name: restaurant.name, status: 'unavailable', url };
  }
}
