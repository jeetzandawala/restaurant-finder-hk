// Configuration file for Hong Kong Table Finder
// Update this file with your specific deployment settings

const CONFIG = {
    // API Configuration - Update with your Railway deployment URL
    API: {
        baseUrl: 'https://restaurant-checker-production.up.railway.app', // Railway production API
        endpoint: '/api/check-stream',
        timeout: 120000, // 2 minutes timeout
    },
    
    // UI Configuration
    UI: {
        animationDuration: 300,
        staggerDelay: 50,
        maxSearchHistory: 10,
    },
    
    // Feature Flags
    FEATURES: {
        darkMode: true,
        searchHistory: true,
        analytics: false,
        serviceWorker: false,
    },
    
    // Analytics (Optional)
    ANALYTICS: {
        googleAnalyticsId: '', // Add your GA4 tracking ID
        facebookPixelId: '',   // Add your Facebook Pixel ID
    },
    
    // SEO Configuration
    SEO: {
        siteName: 'Hong Kong Table Finder',
        description: 'Find available restaurant tables in Hong Kong instantly. Check 70+ premium restaurants across SevenRooms, TableCheck, Chope, and more.',
        keywords: 'Hong Kong restaurants, table reservations, restaurant availability, fine dining HK',
        author: 'JZ Ventures',
        url: 'https://jz-ventures.com',
    }
};

// Export configuration
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CONFIG;
} else {
    window.CONFIG = CONFIG;
}
