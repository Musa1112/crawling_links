# Puppeteer Web Crawler

This project is a web crawler built using Puppeteer and Node.js. The crawler navigates through a website starting from a given URL, collects all the links up to a specified depth, and saves these links along with their depth in a CSV file. The maximum number of requests can be configured, and the crawler is optimized for faster performance by blocking unnecessary resources.

## Features

- Uses Puppeteer for headless browser automation bypasing bot dictation.
- Extracts links up to a specified depth.
- Saves collected links along with their depth in a CSV file.
- Configurable maximum number of requests.
- Optimized for faster performance by blocking images, stylesheets, and fonts.

## Dependencies

- [Puppeteer](https://github.com/puppeteer/puppeteer): Provides a high-level API to control Chrome or Chromium over the DevTools Protocol.
- [dotenv](https://github.com/motdotla/dotenv): Loads environment variables from a `.env` file into `process.env`.
- [fast-csv](https://github.com/C2FO/fast-csv): Provides a simple interface to format and write CSV data.
- [fs](https://nodejs.org/api/fs.html): Node.js file system module to work with the file system.

## Installation

1. Clone the repository
https://github.com/Musa1112/crawling_links

Usage
To run the crawler, use the following command:

# node crawling.js

Code Explanation

Here's a brief explanation of the code:

Imports and Environment Setup:

puppeteer: Used for web scraping and browser automation.
dotenv: Loads environment variables from a .env file.
fs: Used to interact with the file system.
format from @fast-csv/format: Used for CSV formatting and writing.

import puppeteer from 'puppeteer';
import dotenv from 'dotenv';
import fs from 'fs';
import { format } from '@fast-csv/format';

dotenv.config();


Main Function:

Defines the main asynchronous function to run the crawler which contain adjusted feature to bypasses the bot dictation.

```js
(async () => {
    const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

    const browser = await puppeteer.launch({
        headless: false,
        defaultViewport: {
            width: 1920,
            height: 1080,
            deviceScaleFactor: 1
        },
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-infobars',
            '--window-position=0,0',
            '--ignore-certifcate-errors',
            '--ignore-certifcate-errors-spki-list',
            '--disable-dev-shm-usage',
            '--disable-software-rasterizer',
            '--disable-blink-features=AutomationControlled',
            '--disable-features=IsolateOrigins,site-per-process',
            '--disable-web-security'
        ]
    });

    const page = await browser.newPage();

    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36');
    await page.setExtraHTTPHeaders({
        'Accept-Language': 'en-US,en;q=0.9',
    });

    await page.setRequestInterception(true);
    page.on('request', (req) => {
        const resourceType = req.resourceType();
        if (resourceType === 'image' || resourceType === 'stylesheet' || resourceType === 'font') {
            req.abort();
        } else {
            req.continue();
        }
    });

    await page.emulateTimezone('Africa/Lagos');

    await page.evaluateOnNewDocument(() => {
        const originalQuery = window.navigator.permissions.query;
        window.navigator.permissions.query = (parameters) => (
            parameters.name === 'notifications' ? Promise.resolve({ state: Notification.permission }) : originalQuery(parameters)
        );
    });

    const context = browser.defaultBrowserContext();
    await context.overridePermissions('https://www.browserscan.net/', ['geolocation']);
    await page.setGeolocation({
        latitude: 9.6140,
        longitude: 6.5568
    });

    await page.evaluateOnNewDocument(() => {
        Object.defineProperty(navigator, 'webdriver', {
            get: () => false,
        });
    });

    await page.evaluateOnNewDocument(() => {
        const getParameter = WebGLRenderingContext.prototype.getParameter;
        WebGLRenderingContext.prototype.getParameter = function(parameter) {
            if (parameter === 37445) {
                return 'Google Inc. (Intel)';
            }
            if (parameter === 37446) {
                return 'ANGLE (Intel, Intel(R) HD Graphics 620 (0x00005916) Direct3D11 vs_5_0 ps_5_0, D3D11)';
            }
            return getParameter(parameter);
        };
    });

    await page.evaluateOnNewDocument(() => {
        const mockPlugins = [
            {
                name: 'Chrome PDF Viewer',
                filename: 'internal-pdf-viewer',
                description: 'Portable Document Format'
            },
            {
                name: 'Chromium PDF Viewer',
                filename: 'internal-pdf-viewer',
                description: 'Portable Document Format'
            },
            {
                name: 'Microsoft Edge PDF Viewer',
                filename: 'internal-pdf-viewer',
                description: 'Portable Document Format'
            }
        ];

        Object.defineProperty(navigator, 'plugins', {
            get: () => mockPlugins,
        });

        Object.defineProperty(navigator, 'mimeTypes', {
            get: () => mockPlugins.map(plugin => ({
                type: 'application/pdf',
                suffixes: 'pdf',
                description: 'Portable Document Format',
                enabledPlugin: plugin,
            })),
        });
    });

    const startURL = 'https://www.browserscan.net/';

    let queue = [{ url: startURL, depth: 0 }];
    let visited = new Set();
    const targetDepth = 3;
    const maxRequests = process.env.MAX_REQUESTS || 200;

    let collectedLinks = [];

    const extractLinks = async (page) => {
        return await page.evaluate(() => {
            const anchors = Array.from(document.querySelectorAll('a'));
            return anchors.map(anchor => anchor.href);
        });
    };

    while (queue.length > 0 && collectedLinks.length < maxRequests) {
        const { url: currentURL, depth: currentDepth } = queue.shift();

        if (visited.has(currentURL)) continue;

        try {
            await page.goto(currentURL, { waitUntil: 'networkidle2' });
            console.log('Visiting:', currentURL, 'at depth:', currentDepth);

            visited.add(currentURL);

            collectedLinks.push({ url: currentURL, depth: currentDepth });

            if (currentDepth < targetDepth) {
                const links = await extractLinks(page);
                for (const link of links) {
                    if (!visited.has(link) && link.startsWith('http')) {
                        queue.push({ url: link, depth: currentDepth + 1 });
                    }
                }
            }

            await sleep(500);  // Reduced sleep time for faster crawling
        } catch (error) {
            console.error('Error visiting URL:', currentURL, error);
        }
    }

    const csvStream = format({ headers: ['URL', 'Depth'] });
    const writableStream = fs.createWriteStream('collected_links.csv');

    writableStream.on('finish', () => {
        console.log('Done writing to CSV file.');
    });

    csvStream.pipe(writableStream);
    collectedLinks.forEach(({ url, depth }) => {
        csvStream.write({ URL: url, Depth: depth });
    });
    csvStream.end();

    await browser.close();
})();
```
The script launches a Puppeteer browser instance with specific options to enhance performance and evade detection.
A BFS (Breadth-First Search) approach is used to navigate through the website starting from a given URL (startURL), collecting links up to a specified depth (targetDepth).
The crawler extracts links using page.evaluate, which executes JavaScript in the context of the page.
Collected links and their depths are stored in a CSV file using fast-csv.
The maximum number of requests is configurable via environment variables (MAX_REQUESTS), defaulting to 200 if not set.