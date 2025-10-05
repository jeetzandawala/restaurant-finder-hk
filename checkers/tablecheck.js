// checkers/tablecheck.js - Accurate version with date validation
import { getPageText, safeGoto } from './utils.js';

export async function checkTableCheck(page, restaurant, query) {
  const url = restaurant.url || `https://www.tablecheck.com/en/${restaurant.slug}/reserve`;
  
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    
    // Handle modals
    await handleModals(page);
    
    // Wait for content
    await page.waitForTimeout(6000);
    
    // Try to set the date and party size if there are input fields
    await setBookingParameters(page, query);
    
    // Get page content
    const content = await getPageText(page);
    const contentLower = content.toLowerCase();
    
    // STRICT CHECK 1: Strong unavailability messages only
    const unavailableMessages = [
      'no available slots',
      'unfortunately, there is no availability',
      'fully booked on',
      'not available on',
      'no tables available on',
      'sold out',
      'no reservations available on',
      'no slots available for',
      'we are closed on',
      'closed on'
    ];
    
    for (const message of unavailableMessages) {
      if (contentLower.includes(message)) {
        return { name: restaurant.name, status: 'unavailable', url };
      }
    }
    
    // STRICT CHECK 2: Verify requested date is on the page
    const dateFormats = formatDateForValidation(query.date);
    let dateFoundOnPage = false;
    
    for (const format of Object.values(dateFormats)) {
      if (content.includes(format)) {
        dateFoundOnPage = true;
        break;
      }
    }
    
    if (!dateFoundOnPage) {
      console.log(`${restaurant.name}: Date not found on page - might be showing wrong date`);
    }
    
    // STRICT CHECK 3: Look for clickable time slot buttons
    const timeSlotSelectors = [
      'button[data-time]',
      'button[data-slot]',
      '.time-slot',
      '.available-time',
      'button[class*="time"]',
      'button[class*="slot"]'
    ];
    
    let clickableTimeSlots = 0;
    for (const selector of timeSlotSelectors) {
      try {
        const elements = await page.$$(selector);
        for (const el of elements) {
          const isVisible = await el.isVisible();
          const isEnabled = await el.isEnabled();
          if (isVisible && isEnabled) {
            clickableTimeSlots++;
          }
        }
      } catch (e) {
        // Continue
      }
    }
    
    if (clickableTimeSlots >= 2) {
      console.log(`${restaurant.name}: Found ${clickableTimeSlots} clickable time slots`);
      return { name: restaurant.name, status: 'available', url };
    }
    
    // STRICT CHECK 4: Look for time buttons with proper format
    const allButtons = await page.$$('button, a[role="button"]');
    let validTimeButtons = 0;
    
    for (const button of allButtons) {
      try {
        const text = await button.textContent();
        const isVisible = await button.isVisible();
        const isEnabled = await button.isEnabled();
        
        if (text && isVisible && isEnabled) {
          // Match time formats
          const timeMatch = text.match(/\b\d{1,2}:\d{2}\s*(AM|PM)?\b/i);
          if (timeMatch) {
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
    
    // STRICT CHECK 5: Check for booking-specific UI elements
    const hasBookingUI = contentLower.includes('select a time') || 
                         contentLower.includes('choose a time') ||
                         contentLower.includes('available times');
    
    if (hasBookingUI && validTimeButtons > 0) {
      console.log(`${restaurant.name}: Has booking UI with times`);
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
    console.error(`TableCheck error for ${restaurant.name}:`, error.message);
    return { name: restaurant.name, status: 'unavailable', url };
  }
}

// Helper: Set booking parameters in form fields
async function setBookingParameters(page, query) {
  try {
    // Try to fill date input
    const dateInput = await page.$('input[type="date"], input[name*="date"]');
    if (dateInput) {
      await dateInput.fill(query.date);
      await page.waitForTimeout(1000);
    }
    
    // Try to fill party size
    const partySizeSelect = await page.$('select[name*="party"], select[name*="guest"]');
    if (partySizeSelect) {
      await partySizeSelect.selectOption(query.partySize);
      await page.waitForTimeout(1000);
    }
    
    // Try to click search/find button
    const searchButton = await page.$('button:has-text("Search"), button:has-text("Find")');
    if (searchButton) {
      await searchButton.click();
      await page.waitForTimeout(2000);
    }
  } catch (error) {
    // Parameter setting failed, continue with default page load
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