// checkers/chope.js - Accurate version with date validation
import { getPageText, getElementText, safeGoto, safeQuery } from './utils.js';

export async function checkChope(page, restaurant, query) {
  const [year, month, day] = query.date.split('-');
  
  // Build proper Chope URL with parameters
  let url;
  if (restaurant.url && restaurant.url.includes('book.chope.co/booking')) {
    const urlObj = new URL(restaurant.url);
    urlObj.searchParams.set('date', `${day}/${month}/${year}`);
    urlObj.searchParams.set('time', query.time.replace(':', ''));
    urlObj.searchParams.set('adults', query.partySize);
    url = urlObj.toString();
  } else if (restaurant.url) {
    url = restaurant.url;
  } else {
    url = `https://book.chope.co/booking?rid=${restaurant.slug}&date=${day}%2F${month}%2F${year}&time=${query.time.replace(':', '')}&adults=${query.partySize}`;
  }
  
  try {
    const navigationSuccess = await safeGoto(page, url);
    if (!navigationSuccess) {
      return { name: restaurant.name, status: 'unavailable', url };
    }
    
    // Handle modals
    await handleModals(page);
    
    // Wait for content
    await page.waitForTimeout(5000);
    
    // Get page content
    const content = await getPageText(page);
    const contentLower = content.toLowerCase();
    
    // STRICT CHECK 1: Explicit "no availability" messages
    const unavailableMessages = [
      'there are no available timeslots',
      'no available timeslots',
      'fully booked',
      'no availability for',
      'not available on',
      'no tables available',
      'sold out',
      'restaurant is fully booked'
    ];
    
    for (const message of unavailableMessages) {
      if (contentLower.includes(message)) {
        return { name: restaurant.name, status: 'unavailable', url };
      }
    }
    
    // STRICT CHECK 2: Verify date on page
    const dateFormats = formatDateForValidation(query.date);
    let dateFoundOnPage = false;
    
    // Also check Chope's specific date format: "DD/MM/YYYY"
    const chopeDate = `${day}/${month}/${year}`;
    if (content.includes(chopeDate)) {
      dateFoundOnPage = true;
    }
    
    for (const format of Object.values(dateFormats)) {
      if (content.includes(format)) {
        dateFoundOnPage = true;
        break;
      }
    }
    
    if (!dateFoundOnPage) {
      console.log(`${restaurant.name}: Date ${chopeDate} not found on page`);
    }
    
    // STRICT CHECK 3: Look for clickable time slot elements
    const timeSlotSelectors = [
      'button[data-time]',
      'button[class*="timeslot"]',
      '.available-timeslot',
      '.time-button',
      'button[onclick*="time"]',
      'a[class*="timeslot"]'
    ];
    
    let clickableSlots = 0;
    for (const selector of timeSlotSelectors) {
      try {
        const elements = await page.$$(selector);
        for (const el of elements) {
          const isVisible = await el.isVisible();
          const isEnabled = await el.isEnabled();
          if (isVisible && isEnabled) {
            clickableSlots++;
          }
        }
      } catch (e) {
        // Continue
      }
    }
    
    if (clickableSlots >= 2) {
      console.log(`${restaurant.name}: Found ${clickableSlots} clickable time slots`);
      return { name: restaurant.name, status: 'available', url };
    }
    
    // STRICT CHECK 4: Look for actual time buttons
    const allButtons = await page.$$('button, a[role="button"]');
    let validTimeButtons = 0;
    
    for (const button of allButtons) {
      try {
        const text = await button.textContent();
        const isVisible = await button.isVisible();
        const isEnabled = await button.isEnabled();
        
        if (text && isVisible && isEnabled) {
          // Chope uses formats like "19:00", "7:00 PM"
          if (text.match(/^\d{1,2}:\d{2}$/) || text.match(/\d{1,2}:\d{2}\s*(AM|PM)/i)) {
            validTimeButtons++;
          }
        }
      } catch (e) {
        // Skip
      }
    }
    
    if (validTimeButtons >= 2) {
      console.log(`${restaurant.name}: Found ${validTimeButtons} time buttons`);
      return { name: restaurant.name, status: 'available', url };
    }
    
    // STRICT CHECK 5: Check for Chope booking UI with times
    const hasBookingUI = contentLower.includes('available timeslots') || 
                         contentLower.includes('select time') ||
                         contentLower.includes('choose your time');
    
    if (hasBookingUI && validTimeButtons > 0) {
      console.log(`${restaurant.name}: Has booking UI with time options`);
      return { name: restaurant.name, status: 'available', url };
    }
    
    // CONSERVATIVE DEFAULT
    console.log(`${restaurant.name}: No strong availability indicators`);
    return { name: restaurant.name, status: 'unavailable', url };
    
  } catch (error) {
    console.error(`Chope error for ${restaurant.name}:`, error.message);
    return { name: restaurant.name, status: 'unavailable', url };
  }
}

// Helper: Handle modals and popups
async function handleModals(page) {
  try {
    // Chope-specific modal handling
    const closeSelectors = [
      'button[aria-label="Close"]',
      '.modal-close',
      '.close',
      'button:has-text("✕")',
      'button:has-text("×")',
      'button:has-text("Close")',
      '[data-dismiss="modal"]'
    ];
    
    for (const selector of closeSelectors) {
      try {
        const closeButton = await page.$(selector);
        if (closeButton && await closeButton.isVisible()) {
          await closeButton.click();
          await page.waitForTimeout(1000);
          console.log(`${restaurant.name}: Closed modal`);
          break;
        }
      } catch (e) {
        // Continue
      }
    }
    
    // Press Escape
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
    
    // Click outside modal if there's an overlay
    try {
      const overlay = await page.$('.modal-backdrop, .overlay, [class*="backdrop"]');
      if (overlay && await overlay.isVisible()) {
        await overlay.click({ position: { x: 5, y: 5 } });
        await page.waitForTimeout(500);
      }
    } catch (e) {
      // Continue
    }
  } catch (error) {
    // Modal handling failed, continue
  }
}

// Helper: Format date for validation
function formatDateForValidation(dateString) {
  const date = new Date(dateString + 'T12:00:00');
  
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
    isoFormat: dateString
  };
}
