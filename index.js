// index.js
import { chromium } from 'playwright';
import inquirer from 'inquirer';
import chalk from 'chalk';
import fs from 'fs';

// Dynamically import our platform-specific checkers
import { checkSevenRooms } from './checkers/sevenrooms.js';
import { checkChope } from './checkers/chope.js';
import { checkTableCheck } from './checkers/tablecheck.js';
import { checkBistrochat } from './checkers/bistrochat.js';
import { checkResDiary } from './checkers/resdiary.js';

const BATCH_SIZE = 3;
const restaurants = JSON.parse(fs.readFileSync('restaurants.json'));
const DEBUG_MODE = process.env.DEBUG === 'true';

// Create a mapping from platform names to their checker functions
const platformCheckers = {
  sevenrooms: checkSevenRooms,
  chope: checkChope,
  tablecheck: checkTableCheck,
  bistrochat: checkBistrochat,
  resdiary: checkResDiary,
};

function getTodayDateString() {
    const today = new Date();
    return today.toISOString().split('T')[0];
}

async function promptForDetails() {
    console.log(chalk.bold.cyan('--- Restaurant Availability Checker ---'));
    return inquirer.prompt([
        { type: 'input', name: 'date', message: 'Date (YYYY-MM-DD):', default: getTodayDateString() },
        { type: 'list', name: 'partySize', message: 'Party size:', choices: Array.from({ length: 10 }, (_, i) => String(i + 1)), default: '2' },
        { type: 'list', name: 'time', message: 'Time:', choices: ['18:00', '18:30', '19:00', '19:30', '20:00', '20:30', '21:00'], default: '19:00' },
    ]);
}

async function checkRestaurant(browser, restaurant, query) {
    const checker = platformCheckers[restaurant.platform];
    if (!checker) {
        console.log(`- ${restaurant.name}: ${chalk.yellow(`Warning: No checker found for platform '${restaurant.platform}'`)}`);
        return { name: restaurant.name, status: 'error', url: '#' };
    }
    
    const page = await browser.newPage();
    
    // Set a realistic user agent to avoid bot detection
    await page.setExtraHTTPHeaders({
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    });
    
    try {
        const result = await checker(page, restaurant, query);
        const statusMessage = result.status === 'available' ? chalk.green('Available!') : chalk.red('Not Available');
        console.log(`- ${restaurant.name}: ${statusMessage}`);
        return result;
    } catch (e) {
        console.error(`Error checking ${restaurant.name}:`, e);
        return { name: restaurant.name, status: 'error', url: '#' };
    } finally {
        await page.close();
    }
}

(async () => {
    const query = await promptForDetails();
    console.log(chalk.yellow(`\nLaunching browser... Searching for a table for ${query.partySize} on ${query.date} at ${query.time}\n`));
    
    const browser = await chromium.launch({ 
      headless: !DEBUG_MODE,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu'
      ]
    });
    const results = { available: [], unavailable: [] };
    
    for (let i = 0; i < restaurants.length; i += BATCH_SIZE) {
        const batch = restaurants.slice(i, i + BATCH_SIZE);
        const promises = batch.map(r => checkRestaurant(browser, r, query));
        const batchResults = await Promise.all(promises);
        
        batchResults.forEach(result => {
            if (result.status === 'available') results.available.push(result);
            else results.unavailable.push(result);
        });
    }

    await browser.close();

    console.log('\n' + chalk.bold.cyan('--- Check Complete ---'));
    if (results.available.length > 0) {
        console.log(chalk.bold.green('\n✅ Available Restaurants:'));
        results.available.forEach(r => console.log(`- ${chalk.bold(r.name)}: ${chalk.gray(r.url)}`));
    } else {
        console.log(chalk.bold.yellow('\nNo available restaurants found with your criteria.'));
    }
})();
