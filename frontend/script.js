// Hong Kong Table Finder - Frontend JavaScript
// Configuration - Load from config.js or use defaults
const API_CONFIG = window.CONFIG?.API || {
    // Update this to your Railway deployment URL
    baseUrl: 'https://your-railway-app.railway.app', // Replace with your actual Railway URL
    endpoint: '/api/check',
    timeout: 120000 // 2 minutes timeout for comprehensive search
};

// DOM Elements
const elements = {
    form: document.getElementById('searchForm'),
    searchButton: document.getElementById('searchButton'),
    buttonText: document.getElementById('buttonText'),
    loadingText: document.getElementById('loadingText'),
    resultsContainer: document.getElementById('resultsContainer'),
    statsContainer: document.getElementById('statsContainer'),
    availableSection: document.getElementById('availableSection'),
    unavailableSection: document.getElementById('unavailableSection'),
    availableList: document.getElementById('availableList'),
    unavailableList: document.getElementById('unavailableList'),
    noResults: document.getElementById('noResults'),
    errorContainer: document.getElementById('errorContainer'),
    errorMessage: document.getElementById('errorMessage'),
    availableCount: document.getElementById('availableCount'),
    unavailableCount: document.getElementById('unavailableCount'),
    totalCount: document.getElementById('totalCount'),
    darkModeToggle: document.getElementById('darkModeToggle'),
    sunIcon: document.getElementById('sunIcon'),
    moonIcon: document.getElementById('moonIcon'),
    dateInput: document.getElementById('date'),
};

// State Management
let currentSearchController = null;
let currentEventSource = null;
let streamingResults = { available: [], unavailable: [] };

// Initialize App
document.addEventListener('DOMContentLoaded', () => {
    initializeDateInput();
    initializeDarkMode();
    setupEventListeners();
    animateOnLoad();
});

// Set default date to today
function initializeDateInput() {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const todayFormatted = today.toISOString().split('T')[0];
    const tomorrowFormatted = tomorrow.toISOString().split('T')[0];
    
    // Default to tomorrow (restaurants usually don't take same-day bookings)
    elements.dateInput.value = tomorrowFormatted;
    
    // Set minimum date to today
    elements.dateInput.min = todayFormatted;
}

// Dark Mode Functionality
function initializeDarkMode() {
    const isDark = localStorage.getItem('darkMode') === 'true' || 
                   (!localStorage.getItem('darkMode') && window.matchMedia('(prefers-color-scheme: dark)').matches);
    
    if (isDark) {
        document.documentElement.classList.add('dark');
        toggleDarkModeIcons(true);
    }
}

function toggleDarkMode() {
    const isDark = document.documentElement.classList.toggle('dark');
    localStorage.setItem('darkMode', isDark);
    toggleDarkModeIcons(isDark);
}

function toggleDarkModeIcons(isDark) {
    elements.sunIcon.classList.toggle('hidden', isDark);
    elements.moonIcon.classList.toggle('hidden', !isDark);
}

// Event Listeners
function setupEventListeners() {
    elements.form.addEventListener('submit', handleFormSubmit);
    elements.darkModeToggle.addEventListener('click', toggleDarkMode);
    
    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            cancelCurrentSearch();
        }
        if ((e.metaKey || e.ctrlKey) && e.key === '/') {
            e.preventDefault();
            elements.dateInput.focus();
        }
    });
}

// Animation on Load
function animateOnLoad() {
    // Stagger animations
    const animatedElements = document.querySelectorAll('.animate-fade-in, .animate-slide-up');
    animatedElements.forEach((el, index) => {
        el.style.animationDelay = `${index * 0.1}s`;
    });
}

// Form Submission Handler
async function handleFormSubmit(e) {
    e.preventDefault();
    
    // Cancel any existing search
    cancelCurrentSearch();
    
    // Get form data
    const formData = new FormData(elements.form);
    const searchParams = {
        date: formData.get('date'),
        partySize: formData.get('partySize'),
        time: formData.get('time')
    };

    // Validate inputs
    if (!validateInputs(searchParams)) {
        return;
    }

    // Start search
    await performSearch(searchParams);
}

// Input Validation
function validateInputs(params) {
    const { date, partySize, time } = params;
    
    // Date validation
    const selectedDate = new Date(date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (selectedDate < today) {
        showError('Please select a date that is today or in the future.');
        return false;
    }
    
    // Check if date is too far in future (most restaurants only allow booking 30-60 days ahead)
    const maxDate = new Date();
    maxDate.setDate(maxDate.getDate() + 90);
    
    if (selectedDate > maxDate) {
        showError('Please select a date within the next 90 days.');
        return false;
    }
    
    return true;
}

// Main Search Function
async function performSearch(params) {
    try {
        showLoading(true);
        hideError();
        hideResults();
        
        // Create abort controller for this search
        currentSearchController = new AbortController();
        
        // Build URL
        const searchUrl = new URL(API_CONFIG.endpoint, API_CONFIG.baseUrl);
        Object.entries(params).forEach(([key, value]) => {
            searchUrl.searchParams.append(key, value);
        });

        // Make API request
        const response = await fetch(searchUrl.toString(), {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
            },
            signal: currentSearchController.signal,
            timeout: API_CONFIG.timeout
        });

        if (!response.ok) {
            let errorMessage = `Request failed with status ${response.status}`;
            
            try {
                const errorData = await response.json();
                errorMessage = errorData.error || errorData.details || errorMessage;
            } catch (parseError) {
                // Use default error message if JSON parsing fails
                if (response.status === 500) {
                    errorMessage = 'Server is processing your request. Please try again in a moment.';
                } else if (response.status === 429) {
                    errorMessage = 'Too many requests. Please wait a moment and try again.';
                }
            }
            
            throw new Error(errorMessage);
        }

        const data = await response.json();
        
        // Validate response structure
        if (!data || typeof data !== 'object') {
            throw new Error('Invalid response format received from server.');
        }

        displayResults(data);
        
    } catch (error) {
        if (error.name === 'AbortError') {
            // Search was cancelled, don't show error
            return;
        }
        
        console.error('Search error:', error);
        
        let userFriendlyMessage = 'Unable to search restaurants at this time.';
        
        if (error.message.includes('Failed to fetch') || error.message.includes('network')) {
            userFriendlyMessage = 'Network connection error. Please check your internet connection and try again.';
        } else if (error.message.includes('timeout')) {
            userFriendlyMessage = 'Search is taking longer than expected. Please try again.';
        } else if (error.message.length < 100) {
            // Use server error message if it's reasonably short
            userFriendlyMessage = error.message;
        }
        
        showError(userFriendlyMessage);
        
    } finally {
        showLoading(false);
        currentSearchController = null;
    }
}

// Cancel Current Search
function cancelCurrentSearch() {
    if (currentSearchController) {
        currentSearchController.abort();
        currentSearchController = null;
    }
}

// Display Results
function displayResults(data) {
    const { available = [], unavailable = [], totalRestaurants = 0 } = data;
    
    // Update statistics
    updateStatistics(available.length, unavailable.length, totalRestaurants);
    
    // Clear previous results
    elements.availableList.innerHTML = '';
    elements.unavailableList.innerHTML = '';
    
    // Show results container
    elements.resultsContainer.classList.remove('hidden');
    elements.resultsContainer.classList.add('animate-fade-in');
    
    // Show sections based on content
    const hasAvailable = available.length > 0;
    const hasUnavailable = unavailable.length > 0;
    
    if (hasAvailable) {
        elements.availableSection.classList.remove('hidden');
        renderRestaurantList(available, elements.availableList, true);
    } else {
        elements.availableSection.classList.add('hidden');
    }
    
    if (hasUnavailable) {
        elements.unavailableSection.classList.remove('hidden');
        renderRestaurantList(unavailable, elements.unavailableList, false);
    } else {
        elements.unavailableSection.classList.add('hidden');
    }
    
    // Show no results message if no restaurants found
    if (!hasAvailable && !hasUnavailable) {
        elements.noResults.classList.remove('hidden');
    } else {
        elements.noResults.classList.add('hidden');
    }
    
    // Smooth scroll to results
    setTimeout(() => {
        elements.resultsContainer.scrollIntoView({ 
            behavior: 'smooth', 
            block: 'start' 
        });
    }, 100);
}

// Update Statistics
function updateStatistics(available, unavailable, total) {
    // Animate number changes
    animateNumber(elements.availableCount, available);
    animateNumber(elements.unavailableCount, unavailable);
    animateNumber(elements.totalCount, total);
}

// Animate Number Changes
function animateNumber(element, targetValue) {
    const startValue = parseInt(element.textContent) || 0;
    const duration = 1000;
    const startTime = performance.now();
    
    function updateNumber(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        // Ease out animation
        const easedProgress = 1 - Math.pow(1 - progress, 3);
        const currentValue = Math.round(startValue + (targetValue - startValue) * easedProgress);
        
        element.textContent = currentValue;
        
        if (progress < 1) {
            requestAnimationFrame(updateNumber);
        }
    }
    
    requestAnimationFrame(updateNumber);
}

// Render Restaurant List
function renderRestaurantList(restaurants, container, isAvailable) {
    restaurants.forEach((restaurant, index) => {
        const card = createRestaurantCard(restaurant, isAvailable);
        
        // Stagger animation
        card.style.animationDelay = `${index * 0.05}s`;
        card.classList.add('animate-fade-in');
        
        container.appendChild(card);
    });
}

// Create Restaurant Card
function createRestaurantCard(restaurant, isAvailable) {
    const card = document.createElement('a');
    card.href = restaurant.url;
    card.target = '_blank';
    card.rel = 'noopener noreferrer';
    card.className = 'result-card glass-effect rounded-xl p-6 block transition-all duration-300 hover:shadow-lg group';
    
    const statusIcon = isAvailable 
        ? '<svg class="w-6 h-6 text-green-500" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"></path></svg>'
        : '<svg class="w-6 h-6 text-red-500" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"></path></svg>';
    
    const platformBadge = getPlatformBadge(restaurant.platform || extractPlatformFromUrl(restaurant.url));
    
    card.innerHTML = `
        <div class="flex items-start justify-between">
            <div class="flex items-start space-x-4 flex-1">
                <div class="flex-shrink-0 mt-1">
                    ${statusIcon}
                </div>
                <div class="flex-1 min-w-0">
                    <h3 class="font-semibold text-gray-900 dark:text-white text-lg mb-2 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
                        ${escapeHtml(restaurant.name)}
                    </h3>
                    ${platformBadge}
                    ${restaurant.availableSlots ? `<p class="text-sm text-gray-600 dark:text-gray-400 mt-2">Available slots: ${restaurant.availableSlots}</p>` : ''}
                </div>
            </div>
            <div class="flex-shrink-0 ml-4">
                <svg class="w-5 h-5 text-gray-400 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path>
                </svg>
            </div>
        </div>
    `;
    
    return card;
}

// Get Platform Badge
function getPlatformBadge(platform) {
    const badges = {
        sevenrooms: { name: 'SevenRooms', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' },
        tablecheck: { name: 'TableCheck', color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' },
        chope: { name: 'Chope', color: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200' },
        resdiary: { name: 'ResDiary', color: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200' },
        bistrochat: { name: 'BistroChat', color: 'bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200' },
    };
    
    const badge = badges[platform] || { name: platform || 'Unknown', color: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200' };
    
    return `<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${badge.color}">${badge.name}</span>`;
}

// Extract Platform from URL
function extractPlatformFromUrl(url) {
    if (!url) return 'unknown';
    
    if (url.includes('sevenrooms.com')) return 'sevenrooms';
    if (url.includes('tablecheck.com')) return 'tablecheck';
    if (url.includes('chope.co')) return 'chope';
    if (url.includes('resdiary') || url.includes('.hk/reserve')) return 'resdiary';
    if (url.includes('bistrochat.com')) return 'bistrochat';
    
    return 'unknown';
}

// Utility Functions
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function showLoading(loading) {
    elements.searchButton.disabled = loading;
    elements.buttonText.classList.toggle('hidden', loading);
    elements.loadingText.classList.toggle('hidden', !loading);
    elements.loadingText.classList.toggle('flex', loading);
    
    if (loading) {
        elements.searchButton.classList.add('opacity-75', 'cursor-not-allowed');
    } else {
        elements.searchButton.classList.remove('opacity-75', 'cursor-not-allowed');
    }
}

function showError(message) {
    elements.errorMessage.textContent = message;
    elements.errorContainer.classList.remove('hidden');
    elements.errorContainer.classList.add('animate-fade-in');
    
    // Scroll error into view
    setTimeout(() => {
        elements.errorContainer.scrollIntoView({ 
            behavior: 'smooth', 
            block: 'center' 
        });
    }, 100);
}

function hideError() {
    elements.errorContainer.classList.add('hidden');
    elements.errorContainer.classList.remove('animate-fade-in');
}

function hideResults() {
    elements.resultsContainer.classList.add('hidden');
    elements.resultsContainer.classList.remove('animate-fade-in');
}

// Analytics (Optional - remove if not needed)
function trackSearch(params) {
    // Add your analytics tracking here
    if (typeof gtag !== 'undefined') {
        gtag('event', 'search', {
            'custom_parameter_date': params.date,
            'custom_parameter_party_size': params.partySize,
            'custom_parameter_time': params.time
        });
    }
}

// Service Worker Registration (Optional - for PWA capabilities)
// Disabled for now - uncomment when you create sw.js
// if ('serviceWorker' in navigator) {
//     window.addEventListener('load', () => {
//         navigator.serviceWorker.register('/sw.js')
//             .then((registration) => {
//                 console.log('SW registered: ', registration);
//             })
//             .catch((registrationError) => {
//                 console.log('SW registration failed: ', registrationError);
//             });
//     });
// }

// Export for testing (if needed)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        validateInputs,
        extractPlatformFromUrl,
        getPlatformBadge,
        escapeHtml
    };
}
