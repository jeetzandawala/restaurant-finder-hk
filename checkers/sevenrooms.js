// checkers/sevenrooms.js - Accurate version with date validation
import { getPageText, safeGoto } from './utils.js';

export async function checkSevenRooms(page, restaurant, query) {
  // Construct URL with proper parameters
  let url;
  if (restaurant.url) {
    const urlObj = new URL(restaurant.url);
    urlObj.searchParams.set('date', query.date);
    urlObj.searchParams.set('time', query.time);
    urlObj.searchParams.set('party_size', query.partySize);
    url = urlObj.toString();
  } else {
    url = `https://www.sevenrooms.com/reservations/${restaurant.slug}?date=${query.date}&time=${query.time}&party_size=${query.partySize}`;
  }

  try {
    // Navigate with longer timeout
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    
    // Handle modals/popups - try to close them
    await handleModals(page);
    
    // Wait for dynamic content
    await page.waitForTimeout(6000);
    
    // Get all page text
    const content = await getPageText(page);
    const contentLower = content.toLowerCase();
    
    // STRICT CHECK 1: Look for explicit "no availability" messages
    const noAvailabilityIndicators = [
      'there is no availability that meets your search criteria',
      'no availability that meets your search criteria',
      'no times available for',
      'no times available on',
      'fully booked on',
      'not available for this date',
      'no tables available on',
      'sold out for'
    ];
    
    for (const indicator of noAvailabilityIndicators) {
      if (contentLower.includes(indicator)) {
        return { name: restaurant.name, status: 'unavailable', url };
      }
    }
    
    // STRICT CHECK 2: Verify the requested date is shown on the page
    const requestedDate = formatDateForValidation(query.date);
    const dateFormats = [
      requestedDate.fullFormat, // "October 6, 2025"
      requestedDate.shortFormat, // "Oct 6, 2025"
      requestedDate.numericFormat, // "10/6/2025" or "6/10/2025"
      requestedDate.isoFormat // "2025-10-06"
    ];
    
    let dateFoundOnPage = false;
    for (const dateFormat of dateFormats) {
      if (content.includes(dateFormat)) {
        dateFoundOnPage = true;
        break;
      }
    }
    
    // If requested date not found, page might be showing wrong date
    if (!dateFoundOnPage) {
      console.log(`${restaurant.name}: Requested date not found on page`);
      // Continue but be extra strict below
    }
    
    // STRICT CHECK 3: Look for clickable time slot elements (most reliable)
    const timeSlotSelectors = [
      'button[data-testid*="time"]',
      'button[class*="time"]',
      'button[class*="slot"]',
      '.time-slot',
      '[data-slot-time]',
      'button:has-text("PM")',
      'button:has-text("AM")'
    ];
    
    let foundClickableTimeSlots = 0;
    for (const selector of timeSlotSelectors) {
      try {
        const elements = await page.$$(selector);
        for (const el of elements) {
          const isVisible = await el.isVisible();
          const isEnabled = await el.isEnabled();
          if (isVisible && isEnabled) {
            foundClickableTimeSlots++;
          }
        }
      } catch (e) {
        // Selector might not be valid, continue
      }
    }
    
    if (foundClickableTimeSlots >= 2) {
      console.log(`${restaurant.name}: Found ${foundClickableTimeSlots} clickable time slots`);
      return { name: restaurant.name, status: 'available', url };
    }
    
    // STRICT CHECK 4: Look for time buttons in the DOM
    const allButtons = await page.$$('button');
    let timeButtonsFound = 0;
    
    for (const button of allButtons) {
      try {
        const text = await button.textContent();
        const isVisible = await button.isVisible();
        const isEnabled = await button.isEnabled();
        
        if (text && isVisible && isEnabled) {
          // Match time formats: "7:00 PM", "19:00", "7:00PM"
          if (text.match(/\b\d{1,2}:\d{2}\s*(AM|PM)\b/i) || text.match(/^\d{1,2}:\d{2}$/)) {
            timeButtonsFound++;
          }
        }
      } catch (e) {
        // Skip
      }
    }
    
    if (timeButtonsFound >= 3) {
      console.log(`${restaurant.name}: Found ${timeButtonsFound} time buttons`);
      return { name: restaurant.name, status: 'available', url };
    }
    
    // STRICT CHECK 5: Check for "Select a time" or "Experiences Available" with visible times
    const hasSelectTime = contentLower.includes('select a time') || 
                          contentLower.includes('select time') ||
                          contentLower.includes('experiences available');
    
    if (hasSelectTime && (timeButtonsFound > 0 || foundClickableTimeSlots > 0)) {
      console.log(`${restaurant.name}: Has booking UI with some time options`);
      return { name: restaurant.name, status: 'available', url };
    }
    
    // CONSERVATIVE DEFAULT: If we can't find strong evidence of availability, mark unavailable
    console.log(`${restaurant.name}: No strong availability indicators found`);
    return { name: restaurant.name, status: 'unavailable', url };
    
  } catch (error) {
    console.error(`SevenRooms error for ${restaurant.name}:`, error.message);
    return { name: restaurant.name, status: 'error', url };
  }
}

// Helper: Handle modals and popups
async function handleModals(page) {
  try {
    // Common modal close selectors
    const closeSelectors = [
      'button[aria-label="Close"]',
      'button[aria-label="close"]',
      '.modal-close',
      '.close-button',
      '[data-dismiss="modal"]',
      'button:has-text("✕")',
      'button:has-text("×")',
      'button:has-text("Close")'
    ];
    
    for (const selector of closeSelectors) {
      try {
        const closeButton = await page.$(selector);
        if (closeButton) {
          const isVisible = await closeButton.isVisible();
          if (isVisible) {
            await closeButton.click();
            await page.waitForTimeout(1000);
            console.log('Closed modal/popup');
            break;
          }
        }
      } catch (e) {
        // Continue trying other selectors
      }
    }
    
    // Press Escape key to close modals
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
    
  } catch (error) {
    // Modal handling failed, continue anyway
  }
}

// Helper: Format date for validation
function formatDateForValidation(dateString) {
  const date = new Date(dateString + 'T12:00:00'); // Add time to avoid timezone issues
  
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 
                  'July', 'August', 'September', 'October', 'November', 'December'];
  const monthsShort = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 
                       'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  
  const month = date.getMonth();
  const day = date.getDate();
  const year = date.getFullYear();
  
  return {
    fullFormat: `${months[month]} ${day}, ${year}`,
    shortFormat: `${monthsShort[month]} ${day}, ${year}`,
    numericFormat: `${month + 1}/${day}/${year}`,
    numericFormatAlt: `${day}/${month + 1}/${year}`,
    isoFormat: dateString
  };
}