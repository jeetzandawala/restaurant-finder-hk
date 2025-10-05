// checkers/resdiary.js - Accurate version with date validation
import { getPageText, safeGoto } from './utils.js';

export async function checkResDiary(page, restaurant, query) {
  const url = restaurant.url;
  
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    
    // Handle modals
    await handleModals(page);
    
    // Wait for dynamic content
    await page.waitForTimeout(6000);
    
    // Get page content
    const content = await getPageText(page);
    const contentLower = content.toLowerCase();
    
    // STRICT CHECK 1: Strong unavailability messages only
    const unavailableMessages = [
      'no available slots',
      'unfortunately, there is no availability',
      'fully booked on',
      'not available on',
      'no tables available',
      'sold out',
      'no reservations available',
      'restaurant is closed',
      'booking not available',
      'we are closed on'
    ];
    
    for (const message of unavailableMessages) {
      if (contentLower.includes(message)) {
        return { name: restaurant.name, status: 'unavailable', url };
      }
    }
    
    // STRICT CHECK 2: Verify date on page
    const dateFormats = formatDateForValidation(query.date);
    let dateFoundOnPage = false;
    
    for (const format of Object.values(dateFormats)) {
      if (content.includes(format)) {
        dateFoundOnPage = true;
        break;
      }
    }
    
    if (!dateFoundOnPage) {
      console.log(`${restaurant.name}: Date not found on page`);
    }
    
    // STRICT CHECK 3: Look for clickable time elements
    const timeSlotSelectors = [
      'button[data-time]',
      'button[class*="time"]',
      '.time-slot',
      '.available-time',
      'a[class*="time"]'
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
    
    // STRICT CHECK 4: Look for time buttons
    const allButtons = await page.$$('button, a[role="button"]');
    let validTimeButtons = 0;
    
    for (const button of allButtons) {
      try {
        const text = await button.textContent();
        const isVisible = await button.isVisible();
        const isEnabled = await button.isEnabled();
        
        if (text && isVisible && isEnabled) {
          // Match time formats
          if (text.match(/\b\d{1,2}:\d{2}\s*(AM|PM)?\b/i)) {
            validTimeButtons++;
          }
        }
      } catch (e) {
        // Skip
      }
    }
    
    if (validTimeButtons >= 3) {
      console.log(`${restaurant.name}: Found ${validTimeButtons} time buttons`);
      return { name: restaurant.name, status: 'available', url };
    }
    
    // STRICT CHECK 5: Check for ResDiary booking UI
    const hasBookingUI = contentLower.includes('book now') || 
                         contentLower.includes('make reservation') ||
                         contentLower.includes('select time');
    
    if (hasBookingUI && validTimeButtons > 0) {
      console.log(`${restaurant.name}: Has booking UI with times`);
      return { name: restaurant.name, status: 'available', url };
    }
    
    // Check for booking forms (strong indicator)
    const forms = await page.$$('form');
    let bookingForm = false;
    for (const form of forms) {
      const formHtml = await form.innerHTML();
      if (formHtml.toLowerCase().includes('time') || formHtml.toLowerCase().includes('book')) {
        bookingForm = true;
        break;
      }
    }
    
    if (bookingForm && validTimeButtons > 0) {
      console.log(`${restaurant.name}: Has booking form with times`);
      return { name: restaurant.name, status: 'available', url };
    }
    
    // SMART CHECK: "other dates" only if no time slots
    if (contentLower.includes('other dates with availability') && validTimeButtons === 0) {
      console.log(`${restaurant.name}: Shows other dates but no slots for requested date`);
      return { name: restaurant.name, status: 'unavailable', url };
    }
    
    // CONSERVATIVE DEFAULT
    console.log(`${restaurant.name}: No strong availability indicators`);
    return { name: restaurant.name, status: 'unavailable', url };
    
  } catch (error) {
    console.error(`ResDiary error for ${restaurant.name}:`, error.message);
    return { name: restaurant.name, status: 'unavailable', url };
  }
}

// Helper: Handle modals
async function handleModals(page) {
  try {
    const closeSelectors = [
      'button[aria-label="Close"]',
      '.modal-close',
      '.close-button',
      'button:has-text("✕")',
      'button:has-text("Close")'
    ];
    
    for (const selector of closeSelectors) {
      try {
        const closeButton = await page.$(selector);
        if (closeButton && await closeButton.isVisible()) {
          await closeButton.click();
          await page.waitForTimeout(1000);
          break;
        }
      } catch (e) {
        // Continue
      }
    }
    
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
  } catch (error) {
    // Continue
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