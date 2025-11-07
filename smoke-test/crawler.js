const puppeteer = require('puppeteer');
const fs = require('fs');

async function fetchSitemap(baseUrl) {
  try {
    const sitemapUrl = `${baseUrl}/sitemap.xml`;
    console.log(`Fetching sitemap from ${sitemapUrl}`);

    const response = await fetch(sitemapUrl);
    if (!response.ok) {
      console.warn(`Failed to fetch sitemap: ${response.status}`);
      return [];
    }

    const xml = await response.text();
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

  // Fetch URLs from sitemap
  const sitemapUrls = await fetchSitemap(baseUrlString);

  // Add specific URLs to test
  const specificUrls = [
    `${baseUrlString}/rest-api/rest-api/plant/updates-web-socket?explorer=true`,
    `${baseUrlString}/events-api/events-api/inventory/inventory?explorer=true`,
    `${baseUrlString}/rest-api/rest-api/plant/add-plant/llms.txt`,
    `${baseUrlString}/llms.txt`,
    `${baseUrlString}/llms-full.txt`,
  ];

  // Combine sitemap URLs with specific URLs
  const urlsToVisit = [...sitemapUrls, ...specificUrls];

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

    const page = await browser.newPage();
    const pageErrors = [];

    // Listen for console errors
    page.on('console', msg => {
      if (msg.type() === 'error') {
        const errorText = msg.text();
        if (!shouldIgnoreError(currentUrl, errorText)) {
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

    try {
      // Check if this is a text file (llms.txt) - just do a simple fetch instead of full page load
      if (currentUrl.endsWith('.txt')) {
        console.log(`  Checking text file...`);
        const response = await fetch(currentUrl);
        if (!response.ok) {
          const errorMsg = `HTTP ${response.status} for ${currentUrl}`;
          console.error(`  ❌ ${errorMsg}`);
          pageErrors.push(errorMsg);
          results.failedPages++;
        } else {
          const text = await response.text();
          console.log(`  ✅ Success (${text.length} bytes)`);
          if (pageErrors.length === 0) {
            results.successfulPages++;
          } else {
            results.failedPages++;
          }
        }
        await page.close();
        continue;
      }

      const response = await page.goto(currentUrl, {
        waitUntil: 'networkidle2',
        timeout: 30000
      });

      if (!response || !response.ok()) {
        const status = response ? response.status() : 'unknown';
        const errorMsg = `HTTP ${status} for ${currentUrl}`;
        console.error(`  ❌ ${errorMsg}`);
        pageErrors.push(errorMsg);
        results.failedPages++;
      } else {
        console.log(`  ✅ Success`);

        if (pageErrors.length === 0) {
          results.successfulPages++;
        } else {
          results.failedPages++;
        }
      }
    } catch (error) {
      const errorMsg = `Error loading ${currentUrl}: ${error.message}`;
      console.error(`  ❌ ${errorMsg}`);
      pageErrors.push(errorMsg);
      results.failedPages++;
      results.pageErrors.push({ url: currentUrl, error: error.message });
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
