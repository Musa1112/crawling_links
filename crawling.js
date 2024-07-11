import puppeteer from 'puppeteer';  // Importing puppeteer for web scraping
import dotenv from 'dotenv';  // Importing dotenv to load environment variables
import fs from 'fs';  // Importing fs (file system) module to work with the file system
import { format } from '@fast-csv/format';  // Importing format from fast-csv for CSV formatting

// Load environment variables from .env file
dotenv.config();

(async () => {
    // Function to sleep for a specified amount of milliseconds
    const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

    // Launch the browser instance
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

    // Set User Agent
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36');

    // Set Custom Headers
    await page.setExtraHTTPHeaders({
        'Accept-Language': 'en-US,en;q=0.9',
    });

    // Set Viewport and Screen Size (not necessary since defaultViewport is set)
    // await page.setViewport({
    //     width: 1920,
    //     height: 1080,
    //     deviceScaleFactor: 1
    // });

    // Set Timezone
    await page.emulateTimezone('Africa/Lagos');

    // Set Permissions
    await page.evaluateOnNewDocument(() => {
        const originalQuery = window.navigator.permissions.query;
        window.navigator.permissions.query = (parameters) => (
            parameters.name === 'notifications' ? Promise.resolve({ state: Notification.permission }) : originalQuery(parameters)
        );
    });

    // Set Geolocation
    const context = browser.defaultBrowserContext();
    await context.overridePermissions('https://www.browserscan.net/', ['geolocation']);
    await page.setGeolocation({
        latitude: 9.6140,
        longitude: 6.5568
    });

    // Disable WebDriver flag
    await page.evaluateOnNewDocument(() => {
        Object.defineProperty(navigator, 'webdriver', {
            get: () => false,
        });
    });

    // Spoof WebGL Vendor and Renderer
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

    // Spoof Plugins
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

    // The initial URL to start the BFS
    const startURL = 'https://www.browserscan.net/';

    // Queue for BFS with depth tracking
    let queue = [{ url: startURL, depth: 0 }];
    // Set to keep track of visited URLs
    let visited = new Set();
    // Target depth
    const targetDepth = 3;

    // Array to store extracted links
    let collectedLinks = [];

    // Function to extract links from a page
    const extractLinks = async (page) => {
        return await page.evaluate(() => {
            const anchors = Array.from(document.querySelectorAll('a'));
            return anchors.map(anchor => anchor.href);
        });
    };

    while (queue.length > 0) {
        // Dequeue a URL and its depth
        const { url: currentURL, depth: currentDepth } = queue.shift();

        // If the URL has already been visited, skip it
        if (visited.has(currentURL)) continue;

        try {
            // Visit the URL
            await page.goto(currentURL, { waitUntil: 'networkidle2' });
            console.log('Visiting:', currentURL, 'at depth:', currentDepth);

            // Mark the URL as visited
            visited.add(currentURL);

            // Collect the current URL
            collectedLinks.push(currentURL);

            // If the current depth is less than the target depth, extract links and add them to the queue
            if (currentDepth < targetDepth) {
                const links = await extractLinks(page);
                for (const link of links) {
                    if (!visited.has(link) && link.startsWith('http')) {
                        queue.push({ url: link, depth: currentDepth + 1 });
                    }
                }
            }

            // Optional: wait for a short period to avoid overloading the server
            await sleep(1000);
        } catch (error) {
            console.error('Error visiting URL:', currentURL, error);
        }
    }

    // Write the collected links to a CSV file
    const csvStream = format({ headers: ['URL'] });
    const writableStream = fs.createWriteStream('collected_links.csv');

    writableStream.on('finish', () => {
        console.log('Done writing to CSV file.');
    });

    csvStream.pipe(writableStream);
    collectedLinks.forEach(link => {
        csvStream.write({ URL: link });
    });
    csvStream.end();

    await browser.close();
})();
