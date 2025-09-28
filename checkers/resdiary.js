// checkers/resdiary.js
export async function checkResDiary(page, restaurant, query) {
  const url = restaurant.url;
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
    
    // Wait for dynamic content to load
    await page.waitForTimeout(5000);
    
    // Get page content
    const content = await page.textContent('body');
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
      'restaurant is closed',
      'booking not available'
    ];
    
    for (const message of unavailableMessages) {
      if (contentLower.includes(message)) {
        return { name: restaurant.name, status: 'unavailable', url };
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
    
    // Check if our specific requested time appears in clickable elements
    for (const timeVariant of timeVariants) {
      if (contentLower.includes(timeVariant.toLowerCase())) {
        const timeElements = await page.$$(`button:has-text("${timeVariant}"), [data-time*="${timeVariant}"], .time-slot:has-text("${timeVariant}")`);
        if (timeElements.length > 0) {
          return { name: restaurant.name, status: 'available', url };
        }
      }
    }
    
    // Look for booking form elements
    const bookingElements = await page.$$('form, .booking-form, button[type="submit"], .reserve-button');
    if (bookingElements.length > 0) {
      return { name: restaurant.name, status: 'available', url };
    }
    
    // Default to unavailable if we can't find positive indicators of availability
    return { name: restaurant.name, status: 'unavailable', url };
    
  } catch (error) {
    console.error(`ResDiary error for ${restaurant.name}:`, error.message);
    return { name: restaurant.name, status: 'unavailable', url };
  }
}
