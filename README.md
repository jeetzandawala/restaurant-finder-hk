# Restaurant Availability Checker

An automated Node.js tool that checks for table availability across multiple restaurant booking platforms using web automation. The tool supports SevenRooms, Chope, and other platforms, and can be easily extended to support additional booking systems.

## Features

- 🤖 **Automated Browser Automation**: Uses Playwright to simulate real user interactions
- 🍽️ **Multi-Platform Support**: Supports SevenRooms, Chope, TableCheck, Bistrochat, and ResDiary platforms
- 🎯 **Batch Processing**: Efficiently checks multiple restaurants simultaneously
- 🎨 **Interactive CLI**: Beautiful command-line interface with colored output
- ⚡ **Fast & Reliable**: Headless browser automation with smart error handling
- 🔧 **Easily Extensible**: Modular architecture for adding new booking platforms

## Prerequisites

- Node.js (version 16 or higher)
- npm (comes with Node.js)

## Installation

1. **Clone or download the project** and navigate to the project directory:
   ```bash
   cd restaurant-availability-checker
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Install Playwright browsers** (required for automation):
   ```bash
   npx playwright install
   ```

## Usage

1. **Run the application**:
   ```bash
   npm start
   ```

2. **Follow the interactive prompts**:
   - Enter your desired date (YYYY-MM-DD format, defaults to today)
   - Select party size (1-10 people)
   - Choose preferred time slot

3. **Wait for results**: The tool will automatically:
   - Launch a headless browser
   - Visit each restaurant's booking page
   - Check availability for your criteria
   - Display results with colored output

## Sample Output

```
--- Restaurant Availability Checker ---
? Date (YYYY-MM-DD): 2024-01-15
? Party size: 4
? Time: 19:30

Launching browser... Searching for a table for 4 on 2024-01-15 at 19:30

- Carbone (sevenrooms): Available!
- Mott 32 (sevenrooms): Not Available
- Zuma (sevenrooms): Available!
...

--- Check Complete ---

✅ Available Restaurants:
- Carbone: https://www.sevenrooms.com/reservations/carbonehk?date=2024-01-15&time=19:30&party_size=4
- Zuma: https://www.sevenrooms.com/reservations/zumahk?date=2024-01-15&time=19:30&party_size=4
```

## Configuration

### Adding Restaurants

Edit the `restaurants.json` file to add or modify restaurant configurations:

```json
{
  "name": "Restaurant Name",
  "platform": "sevenrooms",
  "slug": "restaurant-booking-slug"
}
```

**Supported platforms:**
- `sevenrooms`: For SevenRooms booking system
- `chope`: For Chope booking system  
- `tablecheck`: For TableCheck booking system
- `bistrochat`: For Bistrochat booking system
- `resdiary`: For ResDiary booking system

### Adding New Platforms

To add support for a new booking platform:

1. **Create a new checker file** in the `checkers/` directory (e.g., `checkers/opentable.js`)
2. **Export a function** that follows this signature:
   ```javascript
   export async function checkOpenTable(page, restaurant, query) {
     // Your platform-specific logic here
     return { name: restaurant.name, status: 'available|unavailable', url };
   }
   ```
3. **Import and register** the new checker in `index.js`:
   ```javascript
   import { checkOpenTable } from './checkers/opentable.js';
   
   const platformCheckers = {
     sevenrooms: checkSevenRooms,
     chope: checkChope,
     tablecheck: checkTableCheck,
     bistrochat: checkBistrochat,
     resdiary: checkResDiary,
     opentable: checkOpenTable, // Add your new platform
   };
   ```

## Project Structure

```
restaurant-availability-checker/
├── checkers/
│   ├── sevenrooms.js    # SevenRooms platform checker
│   ├── chope.js         # Chope platform checker
│   ├── tablecheck.js    # TableCheck platform checker
│   ├── bistrochat.js    # Bistrochat platform checker
│   └── resdiary.js      # ResDiary platform checker
├── package.json         # Project dependencies and scripts
├── restaurants.json     # Restaurant configuration file
├── index.js             # Main application orchestrator
├── .gitignore          # Git ignore file
└── README.md           # This file
```

## Technical Details

- **Browser Engine**: Chromium (via Playwright)
- **Module System**: ES Modules
- **Concurrency**: Batch processing with configurable batch size
- **Error Handling**: Graceful fallbacks for network issues and missing elements
- **Performance**: Headless browser operation for speed

## Troubleshooting

### Common Issues

1. **"Browser not found" error**:
   ```bash
   npx playwright install
   ```

2. **Network timeout errors**:
   - Check your internet connection
   - Some restaurants' websites may be temporarily unavailable

3. **No results found**:
   - Try different time slots or dates
   - Verify restaurant slugs in `restaurants.json` are correct

### Debug Mode

To run with visible browser (useful for debugging):

Edit `index.js` and change:
```javascript
const browser = await chromium.launch({ headless: false });
```

## Contributing

This tool is designed to be easily extensible. To contribute:

1. Fork the repository
2. Add your platform checker in the `checkers/` directory
3. Update the platform mapping in `index.js`
4. Test thoroughly with real restaurant data
5. Submit a pull request

## License

This project is for educational and personal use. Please respect the terms of service of the booking platforms you're checking.

## Disclaimer

This tool is intended for personal use to check restaurant availability. Please use it responsibly and in compliance with the terms of service of the respective booking platforms. The authors are not responsible for any misuse of this tool.
