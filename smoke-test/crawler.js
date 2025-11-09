const puppeteer = require('puppeteer');
const fs = require('fs');

async function fetchSitemap(baseUrl, page) {
  try {
    const sitemapUrl = `${baseUrl}/sitemap.xml`;
    console.log(`Fetching sitemap from ${sitemapUrl}`);

    // Use Puppeteer page to fetch sitemap so it has the preview cookie
    const response = await page.goto(sitemapUrl, { waitUntil: 'networkidle2', timeout: 30000 });

    if (!response || response.status() !== 200) {
      console.warn(`Failed to fetch sitemap: ${response ? response.status() : 'no response'}`);
      return [];
    }

    const xml = await page.content();
    // Extract URLs from sitemap (simple regex approach)
    const urlMatches = xml.matchAll(/<loc>(.*?)<\/loc>/g);
    const urls = Array.from(urlMatches).map(match => match[1]);

    console.log(`Found ${urls.length} URLs in sitemap`);
    return urls;
  } catch (error) {
    console.error(`Error fetching sitemap: ${error.message}`);
    return [];
  }
}

async function crawlSite(startUrl) {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const visitedUrls = new Set();
  const results = {
    totalPages: 0,
    successfulPages: 0,
    failedPages: 0,
    consoleErrors: [],
    networkErrors: [],
    pageErrors: []
  };

  // Extract base URL
  const baseUrl = new URL(startUrl);
  const baseUrlString = `${baseUrl.protocol}//${baseUrl.hostname}`;

  // Create a page to set up cookies by visiting the preview API URL
  console.log(`Setting up preview connection: ${startUrl}`);
  const setupPage = await browser.newPage();

  // Visit the preview API URL to get the cookie (it will redirect to base URL)
  try {
    await setupPage.goto(startUrl, { waitUntil: 'networkidle2', timeout: 30000 });
    console.log('Preview cookie established');
  } catch (error) {
    console.warn(`Warning: Failed to set up preview connection: ${error.message}`);
  }

  // Fetch URLs from sitemap (using the same page so it has the cookie)
  const sitemapUrls = await fetchSitemap(baseUrlString, setupPage);

  // Close the setup page
  await setupPage.close();

  // Add specific URLs to test with expected status codes
  const specificUrls = [
    // API explorers
    { url: `${baseUrlString}/rest-api/rest-api/plant/updates-web-socket?explorer=true`, expectedStatus: 200 },
    { url: `${baseUrlString}/events-api/events-api/inventory/inventory?explorer=true`, expectedStatus: 200 },
    // LLMs.txt files
    { url: `${baseUrlString}/rest-api/rest-api/plant/add-plant/llms.txt`, expectedStatus: 200 },
    { url: `${baseUrlString}/llms.txt`, expectedStatus: 200 },
    { url: `${baseUrlString}/llms-full.txt`, expectedStatus: 200 },
    // LLMs.txt via content negotiation (Accept: text/plain)
    { url: `${baseUrlString}`, expectedStatus: 200, headers: { 'Accept': 'text/plain' }, expectedContentType: 'text/plain' },
    // API endpoints (some require auth)
    { url: `${baseUrlString}/api/fern-docs/search/v2/key`, expectedStatus: 200 },
    { url: `${baseUrlString}/api/fern-docs/get-jwt`, expectedStatus: 401 }, // Expected to require auth
    { url: `${baseUrlString}/_mcp/server`, expectedStatus: 200 },
  ];

  // URL expectations map for easy lookup
  const urlExpectations = new Map();
  specificUrls.forEach(({ url, expectedStatus, headers, expectedContentType }) => {
    urlExpectations.set(url, { expectedStatus, headers, expectedContentType });
  });

  // Combine sitemap URLs with specific URLs (extract just URLs for crawling)
  const urlsToVisit = [...sitemapUrls, ...specificUrls.map(s => s.url)];

  console.log(`Total URLs to crawl: ${urlsToVisit.length}`);
  console.log(`- From sitemap: ${sitemapUrls.length}`);
  console.log(`- Specific URLs: ${specificUrls.length}`);

  // List of errors to ignore (common false positives)
  const ignoredPatterns = [
    /_vercel\/insights/,
    /vercel\.com/,
    /google-analytics/,
    /googletagmanager/,
    /analytics\.js/,
  ];

  const ignoredErrorMessages = [
    'Failed to load resource: the server responded with a status of 404 ()',
    'Failed to load resource: the server responded with a status of 415 ()',  // Unsupported Media Type (from Accept header on resources)
    'Refused to execute script from',
    'Minified React error #418',
  ];

  function shouldIgnoreError(url, message) {
    const fullText = `${url} ${message}`;

    // Check if message contains any ignored patterns
    if (ignoredPatterns.some(pattern => pattern.test(fullText))) {
      return true;
    }

    // Check if message matches any ignored error messages
    if (ignoredErrorMessages.some(msg => message.includes(msg))) {
      return true;
    }

    // Expected error for external-dependency-test page (tests error boundary)
    if (url.includes('external-dependency-test') && message.includes('[error-boundary-fallback]')) {
      return true;
    }

    return false;
  }

  console.log(`Starting crawl...`);

  while (urlsToVisit.length > 0) {
    const currentUrl = urlsToVisit.shift();

    if (visitedUrls.has(currentUrl)) {
      continue;
    }

    visitedUrls.add(currentUrl);
    results.totalPages++;

    console.log(`\nCrawling (${results.totalPages}): ${currentUrl}`);

    // Log custom headers if any
    const expectations = urlExpectations.get(currentUrl) || { expectedStatus: 200 };
    if (expectations.headers) {
      console.log(`  Custom headers: ${JSON.stringify(expectations.headers)}`);
    }

    const page = await browser.newPage();
    const pageErrors = [];

    // Listen for console errors
    page.on('console', msg => {
      if (msg.type() === 'error') {
        const errorText = msg.text();
        const expectedStatus = expectations.expectedStatus;

        // Ignore console errors about expected status codes (e.g., 401 for auth endpoints)
        const isExpectedStatusError = expectedStatus !== 200 &&
          errorText.includes(`status of ${expectedStatus}`);

        if (!shouldIgnoreError(currentUrl, errorText) && !isExpectedStatusError) {
          const error = `Console error on ${currentUrl}: ${errorText}`;
          console.error(`  ❌ ${error}`);
          pageErrors.push(error);
          results.consoleErrors.push({ url: currentUrl, error: errorText });
        }
      }
    });

    // Listen for page errors
    page.on('pageerror', error => {
      const errorMessage = error.message;
      if (!shouldIgnoreError(currentUrl, errorMessage)) {
        const errorMsg = `Page error on ${currentUrl}: ${errorMessage}`;
        console.error(`  ❌ ${errorMsg}`);
        pageErrors.push(errorMsg);
        results.pageErrors.push({ url: currentUrl, error: errorMessage });
      }
    });

    // Listen for failed requests
    page.on('requestfailed', request => {
      const failedUrl = request.url();
      const errorText = request.failure().errorText;
      if (!shouldIgnoreError(failedUrl, errorText)) {
        const errorMsg = `Failed request on ${currentUrl}: ${failedUrl} - ${errorText}`;
        console.error(`  ❌ ${errorMsg}`);
        pageErrors.push(errorMsg);
        results.networkErrors.push({ url: currentUrl, failedUrl: failedUrl, error: errorText });
      }
    });

    const expectedStatus = expectations.expectedStatus;
    const customHeaders = expectations.headers;
    const expectedContentType = expectations.expectedContentType;

    try {

      // Set custom headers if specified
      if (customHeaders) {
        // Add cache-busting header to bypass Vercel edge cache
        const headersWithCacheBust = {
          ...customHeaders,
          'Cache-Control': 'no-cache'
        };
        await page.setExtraHTTPHeaders(headersWithCacheBust);
        // Disable cache for pages with custom headers to ensure we get the actual response
        await page.setCacheEnabled(false);
      }

      // Use Puppeteer for all requests (including text files) to maintain cookies
      const response = await page.goto(currentUrl, {
        waitUntil: 'networkidle2',
        timeout: 30000
      });

      const actualStatus = response ? response.status() : 0;

      // Log response headers for debugging
      if (response) {
        const responseHeaders = response.headers();
        console.log(`  Response: ${actualStatus} ${response.statusText()}`);
        console.log(`  Content-Type: ${responseHeaders['content-type'] || 'none'}`);
        if (customHeaders || expectedContentType) {
          // Log all response headers for requests with special expectations
          console.log(`  All response headers: ${JSON.stringify(responseHeaders, null, 2)}`);
        }
      }

      // 304 Not Modified is treated as success (means it was cached from a previous request)
      const isSuccess = actualStatus === expectedStatus || (expectedStatus === 200 && actualStatus === 304);

      // Check status code
      if (!response || !isSuccess) {
        const errorMsg = `HTTP ${actualStatus} for ${currentUrl} (expected ${expectedStatus})`;
        console.error(`  ❌ ${errorMsg}`);
        pageErrors.push(errorMsg);
        results.failedPages++;
      } else {
        // Check content-type if specified
        if (expectedContentType) {
          const actualContentType = response.headers()['content-type'] || '';
          if (!actualContentType.includes(expectedContentType)) {
            const errorMsg = `Wrong Content-Type for ${currentUrl}: got "${actualContentType}", expected "${expectedContentType}"`;
            console.error(`  ❌ ${errorMsg}`);
            pageErrors.push(errorMsg);
            results.failedPages++;
          } else {
            // Check if this is a text file for simpler success logging
            if (currentUrl.endsWith('.txt') || expectedContentType === 'text/plain') {
              const content = await page.content();
              console.log(`  ✅ Success (${content.length} bytes, status ${actualStatus}, content-type: ${actualContentType})`);
            } else {
              console.log(`  ✅ Success (status ${actualStatus}, content-type: ${actualContentType})`);
            }

            if (pageErrors.length === 0) {
              results.successfulPages++;
            } else {
              results.failedPages++;
            }
          }
        } else {
          // No content-type check needed
          if (currentUrl.endsWith('.txt')) {
            const content = await page.content();
            console.log(`  ✅ Success (${content.length} bytes, status ${actualStatus})`);
          } else {
            console.log(`  ✅ Success (status ${actualStatus})`);
          }

          if (pageErrors.length === 0) {
            results.successfulPages++;
          } else {
            results.failedPages++;
          }
        }
      }
    } catch (error) {
      const errorMsg = `Error loading ${currentUrl}: ${error.message}`;
      console.error(`  ❌ ${errorMsg}`);
      pageErrors.push(errorMsg);
      results.failedPages++;
      results.pageErrors.push({ url: currentUrl, error: error.message });
    }

    // Clear custom headers and re-enable cache for next page
    if (expectations && expectations.headers) {
      await page.setExtraHTTPHeaders({});
      await page.setCacheEnabled(true);
    }

    await page.close();
  }

  await browser.close();

  console.log('\n' + '='.repeat(60));
  console.log('CRAWL SUMMARY');
  console.log('='.repeat(60));
  console.log(`Total pages crawled: ${results.totalPages}`);
  console.log(`Successful pages: ${results.successfulPages}`);
  console.log(`Pages with errors: ${results.failedPages}`);
  console.log(`Console errors: ${results.consoleErrors.length}`);
  console.log(`Network errors: ${results.networkErrors.length}`);
  console.log(`Page errors: ${results.pageErrors.length}`);

  // Write detailed results to file
  fs.writeFileSync('crawler-results.json', JSON.stringify(results, null, 2));

  // Collect unique URLs with errors
  const urlsWithErrors = new Set();
  results.consoleErrors.forEach(err => urlsWithErrors.add(err.url));
  results.networkErrors.forEach(err => urlsWithErrors.add(err.url));
  results.pageErrors.forEach(err => urlsWithErrors.add(err.url));

  // Write summary for PR comment
  let summary = `## 🕷️ Smoke Test Crawler Results\n\n`;
  summary += `**Pages crawled:** ${results.totalPages}\n`;
  summary += `**Successful:** ${results.successfulPages} ✅\n`;
  summary += `**With errors:** ${results.failedPages} ❌\n\n`;

  if (results.failedPages === 0) {
    summary += `🎉 All pages loaded successfully with no errors!\n`;
  } else {
    summary += `### ❌ Pages with Errors\n\n`;

    // List all URLs with errors
    Array.from(urlsWithErrors).forEach(url => {
      summary += `**${url}**\n`;

      // Show console errors for this URL
      const consoleErrs = results.consoleErrors.filter(e => e.url === url);
      if (consoleErrs.length > 0) {
        summary += `- Console errors (${consoleErrs.length}):\n`;
        consoleErrs.slice(0, 3).forEach(err => {
          summary += `  - ${err.error}\n`;
        });
        if (consoleErrs.length > 3) {
          summary += `  - ... and ${consoleErrs.length - 3} more\n`;
        }
      }

      // Show network errors for this URL
      const netErrs = results.networkErrors.filter(e => e.url === url);
      if (netErrs.length > 0) {
        summary += `- Network errors (${netErrs.length}):\n`;
        netErrs.slice(0, 3).forEach(err => {
          summary += `  - Failed to load \`${err.failedUrl}\`: ${err.error}\n`;
        });
        if (netErrs.length > 3) {
          summary += `  - ... and ${netErrs.length - 3} more\n`;
        }
      }

      // Show page errors for this URL
      const pageErrs = results.pageErrors.filter(e => e.url === url);
      if (pageErrs.length > 0) {
        summary += `- Page errors (${pageErrs.length}):\n`;
        pageErrs.slice(0, 3).forEach(err => {
          summary += `  - ${err.error}\n`;
        });
        if (pageErrs.length > 3) {
          summary += `  - ... and ${pageErrs.length - 3} more\n`;
        }
      }

      summary += `\n`;
    });

    summary += `\n<details>\n<summary>📊 Full error breakdown</summary>\n\n`;
    summary += `- **Console errors:** ${results.consoleErrors.length}\n`;
    summary += `- **Network errors:** ${results.networkErrors.length}\n`;
    summary += `- **Page errors:** ${results.pageErrors.length}\n`;
    summary += `\nSee full details in the workflow logs.\n`;
    summary += `</details>\n`;
  }

  fs.writeFileSync('crawler-summary.txt', summary);

  return results;
}

// Get URL from command line
const url = process.argv[2];
if (!url) {
  console.error('Usage: node crawler.js <url>');
  process.exit(1);
}

crawlSite(url)
  .then(results => {
    // Exit with error code if there were failures
    process.exit(results.failedPages > 0 ? 1 : 0);
  })
  .catch(error => {
    console.error('Crawler failed:', error);
    process.exit(1);
  });
