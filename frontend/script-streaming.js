// Hong Kong Table Finder - Ultra-Fast Streaming Version
// Configuration
const API_CONFIG = window.CONFIG?.API || {
    baseUrl: 'https://restaurant-checker-production.up.railway.app',
    endpoint: '/api/check-stream',
    timeout: 120000
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
let currentEventSource = null;
let streamingResults = { available: [], unavailable: [] };
let searchStartTime = null;

// Initialize App
document.addEventListener('DOMContentLoaded', () => {
    initializeDateInput();
    initializeDarkMode();
    setupEventListeners();
    animateOnLoad();
});

// Set default date to tomorrow
function initializeDateInput() {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const todayFormatted = today.toISOString().split('T')[0];
    const tomorrowFormatted = tomorrow.toISOString().split('T')[0];
    
    elements.dateInput.value = tomorrowFormatted;
    elements.dateInput.min = todayFormatted;
}

// Dark Mode
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
    
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            cancelCurrentSearch();
        }
    });
}

// Handle Form Submission
function handleFormSubmit(event) {
    event.preventDefault();
    
    const formData = new FormData(elements.form);
    const date = formData.get('date');
    const time = formData.get('time');
    const partySize = formData.get('partySize');
    
    if (!validateInputs(date, time, partySize)) {
        return;
    }
    
    performStreamingSearch(date, time, partySize);
}

// Validate Inputs
function validateInputs(date, time, partySize) {
    if (!date || !time || !partySize) {
        showError('Please fill in all fields.');
        return false;
    }
    
    const selectedDate = new Date(date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (selectedDate < today) {
        showError('Please select a future date.');
        return false;
    }
    
    return true;
}

// Perform Streaming Search
async function performStreamingSearch(date, time, partySize) {
    // Reset state
    streamingResults = { available: [], unavailable: [] };
    elements.resultsContainer.classList.add('hidden');
    elements.errorContainer.classList.add('hidden');
    elements.availableList.innerHTML = '';
    elements.unavailableList.innerHTML = '';
    
    // Show loading
    showLoading(true);
    searchStartTime = Date.now();
    
    try {
        const params = new URLSearchParams({ date, time, partySize });
        const apiUrl = `${API_CONFIG.baseUrl}${API_CONFIG.endpoint}?${params}`;
        
        // Close any existing connection
        if (currentEventSource) {
            currentEventSource.close();
        }
        
        // Create EventSource for Server-Sent Events
        currentEventSource = new EventSource(apiUrl);
        
        currentEventSource.onmessage = (event) => {
            try {
                const update = JSON.parse(event.data);
                handleStreamUpdate(update);
            } catch (error) {
                console.error('Failed to parse update:', error);
            }
        };
        
        currentEventSource.onerror = (error) => {
            console.error('Stream error:', error);
            closeStream();
            
            // Show error if we haven't received any results
            if (streamingResults.available.length === 0 && streamingResults.unavailable.length === 0) {
                showError('Connection error. Please try again.');
                showLoading(false);
            }
        };
        
    } catch (error) {
        console.error('Search error:', error);
        showError('Unable to start search. Please try again.');
        showLoading(false);
    }
}

// Handle Stream Updates
function handleStreamUpdate(update) {
    const elapsed = ((Date.now() - searchStartTime) / 1000).toFixed(1);
    
    switch (update.type) {
        case 'start':
            updateLoadingText(`Starting search of ${update.totalRestaurants} restaurants...`);
            elements.resultsContainer.classList.remove('hidden');
            elements.statsContainer.classList.remove('hidden');
            updateStatistics(0, 0, update.totalRestaurants);
            break;
            
        case 'status':
            updateLoadingText(update.message);
            break;
            
        case 'checking':
            updateLoadingText(`Checking: ${update.restaurant}... (${update.completed}/${update.total}) - ${elapsed}s`);
            break;
            
        case 'result':
            // Show available restaurant immediately
            streamingResults.available.push(update.result);
            addRestaurantToList(update.result, elements.availableList, true);
            elements.availableSection.classList.remove('hidden');
            updateStatistics(streamingResults.available.length, streamingResults.unavailable.length, update.total);
            updateLoadingText(`Found ${streamingResults.available.length} available! Checking more... (${elapsed}s)`);
            break;
            
        case 'progress':
            if (update.status === 'unavailable' || update.status === 'error') {
                streamingResults.unavailable.push({ name: update.restaurant });
            }
            updateStatistics(streamingResults.available.length, streamingResults.unavailable.length, update.total);
            break;
            
        case 'complete':
            closeStream();
            showLoading(false);
            
            const totalTime = ((Date.now() - searchStartTime) / 1000).toFixed(1);
            console.log(`Search completed in ${totalTime}s`);
            
            // Show unavailable section and render unavailable restaurants
            if (streamingResults.unavailable.length > 0) {
                elements.unavailableSection.classList.remove('hidden');
                // Render unavailable restaurants to the list
                streamingResults.unavailable.forEach(restaurant => {
                    addRestaurantToList(restaurant, elements.unavailableList, false);
                });
            }
            
            // Show no results message if nothing found
            if (streamingResults.available.length === 0 && streamingResults.unavailable.length === 0) {
                elements.noResults.classList.remove('hidden');
            }
            break;
            
        case 'error':
            closeStream();
            showError(update.error || 'An error occurred');
            showLoading(false);
            break;
    }
}

// Close Stream
function closeStream() {
    if (currentEventSource) {
        currentEventSource.close();
        currentEventSource = null;
    }
}

// Cancel Search
function cancelCurrentSearch() {
    closeStream();
    showLoading(false);
}

// Update Loading Text
function updateLoadingText(text) {
    if (elements.loadingText) {
        elements.loadingText.textContent = text;
    }
}

// Add Restaurant to List (Streaming) - Beautiful Cards with Tailwind
function addRestaurantToList(restaurant, container, isAvailable) {
    const card = document.createElement('div');
    card.className = `
        bg-white dark:bg-gray-800 
        rounded-xl shadow-lg 
        border border-gray-200 dark:border-gray-700
        p-6 
        transition-all duration-300 
        hover:shadow-xl hover:scale-105
        animate-slide-up
    `;
    card.style.opacity = '0';
    
    const statusColor = isAvailable 
        ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' 
        : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400';
    const statusIcon = isAvailable ? '✓' : '✗';
    const statusText = isAvailable ? 'Available' : 'Unavailable';
    
    card.innerHTML = `
        <div class="flex flex-col h-full">
            <!-- Restaurant Header -->
            <div class="flex items-start justify-between mb-4">
                <h3 class="text-xl font-bold text-gray-900 dark:text-white pr-4 flex-1">
                    ${escapeHtml(restaurant.name)}
                </h3>
                <span class="
                    ${statusColor}
                    px-3 py-1 
                    rounded-full 
                    text-xs font-semibold 
                    flex items-center gap-1
                    whitespace-nowrap
                ">
                    <span class="text-sm">${statusIcon}</span>
                    ${statusText}
                </span>
            </div>
            
            <!-- Book Button for Available -->
            ${isAvailable ? `
                <a href="${escapeHtml(restaurant.url)}" 
                   target="_blank" 
                   rel="noopener noreferrer" 
                   class="
                       mt-auto
                       bg-primary-600 hover:bg-primary-700 
                       dark:bg-primary-500 dark:hover:bg-primary-600
                       text-white 
                       font-semibold 
                       py-3 px-6 
                       rounded-lg 
                       text-center
                       transition-all duration-200
                       hover:shadow-lg
                       focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2
                       inline-flex items-center justify-center gap-2
                   ">
                    <span>Book Now</span>
                    <span class="text-lg">→</span>
                </a>
            ` : `
                <div class="mt-auto pt-3 border-t border-gray-200 dark:border-gray-700">
                    <p class="text-sm text-gray-500 dark:text-gray-400 text-center">
                        No availability for selected time
                    </p>
                </div>
            `}
        </div>
    `;
    
    container.appendChild(card);
    
    // Animate in
    setTimeout(() => {
        card.style.opacity = '1';
        card.style.transform = 'translateY(0)';
    }, 50);
}

// Update Statistics
function updateStatistics(available, unavailable, total) {
    elements.availableCount.textContent = available;
    elements.unavailableCount.textContent = unavailable;
    elements.totalCount.textContent = total;
    
    // Update progress visually
    const checked = available + unavailable;
    const percentage = total > 0 ? Math.round((checked / total) * 100) : 0;
    
    if (elements.buttonText) {
        if (checked < total) {
            elements.buttonText.textContent = `Searching... ${percentage}%`;
        }
    }
}

// Show Loading
function showLoading(show) {
    if (show) {
        elements.searchButton.disabled = true;
        elements.searchButton.classList.add('loading');
        elements.buttonText.classList.add('hidden');
        elements.loadingText.classList.remove('hidden');
    } else {
        elements.searchButton.disabled = false;
        elements.searchButton.classList.remove('loading');
        elements.buttonText.classList.remove('hidden');
        elements.loadingText.classList.add('hidden');
        elements.buttonText.textContent = 'Find Available Tables';
    }
}

// Show Error
function showError(message) {
    elements.errorContainer.classList.remove('hidden');
    elements.errorMessage.textContent = message;
    
    setTimeout(() => {
        elements.errorContainer.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 100);
}

// Escape HTML
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Animate on Load
function animateOnLoad() {
    const hero = document.querySelector('.hero-section');
    if (hero) {
        setTimeout(() => {
            hero.classList.add('animate-fade-in');
        }, 100);
    }
}
