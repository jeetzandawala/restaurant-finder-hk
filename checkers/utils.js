// checkers/utils.js - Utility functions for external browser service compatibility

/**
 * Get text content from page - compatible with external browser services
 */
export async function getPageText(page, selector = 'body') {
    try {
        return await page.evaluate((sel) => {
            const element = sel === 'body' ? document.body : document.querySelector(sel);
            return element ? (element.textContent || element.innerText || '') : '';
        }, selector);
    } catch (error) {
        console.warn('Error getting page text:', error.message);
        return '';
    }
}

/**
 * Get text content from element - compatible with external browser services  
 */
export async function getElementText(element) {
    try {
        return await element.evaluate(el => el.textContent || el.innerText || '');
    } catch (error) {
        console.warn('Error getting element text:', error.message);
        return '';
    }
}

/**
 * Safe page navigation with error handling
 */
export async function safeGoto(page, url, options = {}) {
    try {
        await page.goto(url, { 
            waitUntil: 'domcontentloaded', 
            timeout: 45000,
            ...options 
        });
        return true;
    } catch (error) {
        console.warn('Navigation error:', error.message);
        return false;
    }
}

/**
 * Safe element querying
 */
export async function safeQuery(page, selector) {
    try {
        return await page.$$(selector);
    } catch (error) {
        console.warn('Query error:', error.message);
        return [];
    }
}
