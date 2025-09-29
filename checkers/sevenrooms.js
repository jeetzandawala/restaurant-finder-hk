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
    
    // Look for positive indicators of availability - be more strict
    // 1. Look for actual time slot buttons/links that can be clicked
    const timeSlotElements = await page.$$('button[data-time], a[data-time], .time-slot[data-time], [class*="time-slot"], [class*="available"]');
    if (timeSlotElements.length > 0) {
      // Found time slot elements, check if any match our requested time
      const requestedTime = query.time; // e.g., "19:00"
      const timeVariants = [
        requestedTime, // "19:00"
        requestedTime.replace(':', ''), // "1900"
        requestedTime.substring(0, 5), // "19:00"
      ];
      
      for (const element of timeSlotElements) {
        const elementText = await element.textContent();
        if (elementText && timeVariants.some(variant => elementText.includes(variant))) {
          return { name: restaurant.name, status: 'available', url };
        }
      }
    }
    
    // 2. Look for booking/reservation buttons that indicate availability
    const bookingButtons = await page.$$('button:has-text("Book"), button:has-text("Reserve"), button:has-text("Complete"), input[type="submit"]');
    if (bookingButtons.length > 0) {
      // Check if these buttons are actually clickable (not disabled)
      for (const button of bookingButtons) {
        const isDisabled = await button.isDisabled();
        const isVisible = await button.isVisible();
        if (!isDisabled && isVisible) {
          return { name: restaurant.name, status: 'available', url };
        }
      }
    }
    
    // 3. Look for calendar or date picker elements indicating an active booking system
    const calendarElements = await page.$$('.calendar, .datepicker, [data-date], .booking-calendar');
    if (calendarElements.length > 0) {
      return { name: restaurant.name, status: 'available', url };
    }
    
    // Default to unavailable if we can't find positive indicators of availability
    // This is more conservative but reduces false positives
    return { name: restaurant.name, status: 'unavailable', url };
    
  } catch (error) {
    console.error(`SevenRooms error for ${restaurant.name}:`, error.message);
    return { name: restaurant.name, status: 'error', url };
  }
}
