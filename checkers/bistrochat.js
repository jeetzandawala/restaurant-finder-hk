// checkers/bistrochat.js - Accurate version with date validation
import { getPageText, safeGoto } from './utils.js';

export async function checkBistrochat(page, restaurant, query) {
  const url = restaurant.url || `https://book.bistrochat.com/${restaurant.slug}`;
  
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    
    // Handle modals
    await handleModals(page);
    
    // Wait for Bistrochat's dynamic content (it's quite heavy)
    await page.waitForTimeout(7000);
    
    // Get page content
    const content = await getPageText(page);
    const contentLower = content.toLowerCase();
    
    // STRICT CHECK 1: Explicit unavailability messages
    const unavailableMessages = [
      'no available slots',
      'no availability for',
      'fully booked on',
      'not available on',
      'no tables available',
      'sold out',
      'no reservations available',
      'restaurant is closed on',
      'booking not available for',
      'we are closed'
    ];
    
    for (const message of unavailableMessages) {
      if (contentLower.includes(message)) {
        return { name: restaurant.name, status: 'unavailable', url };
      }
    }
    
    // STRICT CHECK 2: Verify date is on page
    const dateFormats = formatDateForValidation(query.date);
    let dateFoundOnPage = false;
    
    for (const format of Object.values(dateFormats)) {
      if (content.includes(format)) {
        dateFoundOnPage = true;
        break;
      }
    }
    
    if (!dateFoundOnPage) {
      console.log(`${restaurant.name}: Date not found - may be wrong date`);
      // For Bistrochat, this is critical - if date not shown, likely wrong page
      return { name: restaurant.name, status: 'unavailable', url };
    }
    
    // STRICT CHECK 3: Look for clickable time buttons (Bistrochat shows many)
    const timeButtons = await page.$$('button');
    let validTimeButtons = 0;
    
    for (const button of timeButtons) {
      try {
        const text = await button.textContent();
        const isVisible = await button.isVisible();
        const isEnabled = await button.isEnabled();
        
        if (text && isVisible && isEnabled) {
          // Bistrochat uses "HH:MM" format
          if (text.match(/^\d{1,2}:\d{2}$/)) {
            validTimeButtons++;
          }
        }
      } catch (e) {
        // Skip
      }
    }
    
    // Bistrochat typically shows 5+ time slots when available
    if (validTimeButtons >= 5) {
      console.log(`${restaurant.name}: Found ${validTimeButtons} time slots`);
      return { name: restaurant.name, status: 'available', url };
    }
    
    // STRICT CHECK 4: Check for Bistrochat booking interface
    const hasBookingInterface = contentLower.includes('how many of you') ||
                                contentLower.includes('when would you like') ||
                                contentLower.includes('select a time');
    
    if (hasBookingInterface && validTimeButtons >= 3) {
      console.log(`${restaurant.name}: Has booking interface with ${validTimeButtons} times`);
      return { name: restaurant.name, status: 'available', url };
    }
    
    // STRICT CHECK 5: Check for "book" buttons that are enabled
    let bookableButtons = 0;
    for (const button of timeButtons) {
      try {
        const text = await button.textContent();
        const isVisible = await button.isVisible();
        const isEnabled = await button.isEnabled();
        
        if (text && isVisible && isEnabled) {
          const lowerText = text.toLowerCase();
          if (lowerText.includes('book') || lowerText.includes('reserve')) {
            bookableButtons++;
          }
        }
      } catch (e) {
        // Skip
      }
    }
    
    if (bookableButtons > 0 && validTimeButtons > 0) {
      console.log(`${restaurant.name}: Has ${bookableButtons} book buttons with times`);
      return { name: restaurant.name, status: 'available', url };
    }
    
    // CONSERVATIVE DEFAULT - No longer defaulting to "available"!
    console.log(`${restaurant.name}: No strong availability indicators (found ${validTimeButtons} time buttons)`);
    return { name: restaurant.name, status: 'unavailable', url };
    
  } catch (error) {
    console.error(`Bistrochat error for ${restaurant.name}:`, error.message);
    return { name: restaurant.name, status: 'unavailable', url };
  }
}

// Helper: Handle modals and popups
async function handleModals(page) {
  try {
    const closeSelectors = [
      'button[aria-label="Close"]',
      'button[aria-label="close"]',
      '.modal-close',
      '.close-button',
      'button:has-text("✕")',
      'button:has-text("×")',
      'button:has-text("Close")',
      '[data-dismiss]'
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
    dayMonthFormat: `${day} ${monthsShort[month]}`,
    isoFormat: dateString
  };
}