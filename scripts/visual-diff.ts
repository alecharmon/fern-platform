#!/usr/bin/env tsx
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import pixelmatch from "pixelmatch";
import { type Browser, type BrowserContext, chromium } from "playwright";
import { PNG } from "pngjs";
import * as readline from "readline";

function prompt(question: string): Promise<string> {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    return new Promise((resolve) => {
        rl.question(question, (answer) => {
            rl.close();
            resolve(answer.trim());
        });
    });
}

function normalizeUrl(url: string): string {
    let normalized = url.trim();
    if (!normalized.startsWith("http://") && !normalized.startsWith("https://")) {
        normalized = `https://${normalized}`;
    }
    return normalized;
}

function buildPreviewUrl(previewUrlInput: string, liveUrl: string): string {
    const normalizedPreview = normalizeUrl(previewUrlInput);
    const normalizedLive = normalizeUrl(liveUrl);

    try {
        const previewParsed = new URL(normalizedPreview);
        const liveParsed = new URL(normalizedLive);
        const liveHost = liveParsed.hostname;

        const fullPreviewUrl = `https://${previewParsed.hostname}/api/fern-docs/preview?host=${liveHost}`;

        return fullPreviewUrl;
    } catch {
        return normalizedPreview;
    }
}

function getDomainSlug(url: string): string {
    try {
        const parsed = new URL(normalizeUrl(url));
        return parsed.hostname.replace(/\./g, "-");
    } catch {
        return url.replace(/[^a-zA-Z0-9]/g, "-");
    }
}

interface VisualDiffOptions {
    liveUrl: string;
    previewUrl: string;
    outputDir: string;
    threshold: number;
    diffThreshold: number;
    maxPages?: number;
    maxDiffs?: number;
    concurrency: number;
    waitTime: number;
}

interface DiffResult {
    page: string;
    domain: string;
    liveUrl: string;
    previewUrl: string;
    liveScreenshot: string;
    previewScreenshot: string;
    diffScreenshot: string | null;
    diffPixels: number;
    diffPercentage: number;
    hasDiff: boolean;
    error?: string;
}

interface CrawlResults {
    domain: string;
    totalPages: number;
    pagesWithDiffs: number;
    pagesWithErrors: number;
    results: DiffResult[];
}

interface MultiDomainResults {
    domains: CrawlResults[];
    totalPages: number;
    totalDiffs: number;
    totalErrors: number;
}

async function fetchSitemap(baseUrl: string, context: BrowserContext): Promise<string[]> {
    const page = await context.newPage();
    try {
        const sitemapUrl = `${baseUrl}/sitemap.xml`;
        console.log(`Fetching sitemap from ${sitemapUrl}`);

        const response = await page.goto(sitemapUrl, {
            waitUntil: "networkidle",
            timeout: 30000
        });

        if (!response || response.status() !== 200) {
            console.warn(`Failed to fetch sitemap: ${response ? response.status() : "no response"}`);
            return [];
        }

        const xml = await page.content();
        const urlMatches = xml.matchAll(/<loc>(.*?)<\/loc>/g);
        const urls = Array.from(urlMatches).map((match) => match[1]);

        console.log(`Found ${urls.length} URLs in sitemap`);
        return urls;
    } catch (error) {
        console.error(`Error fetching sitemap: ${error instanceof Error ? error.message : error}`);
        return [];
    } finally {
        await page.close();
    }
}

function extractPathFromUrl(url: string): string {
    try {
        const parsed = new URL(url);
        return parsed.pathname || "/";
    } catch {
        return url;
    }
}

function sanitizeFilename(pagePath: string): string {
    return pagePath.replace(/^\//, "").replace(/\//g, "_") || "index";
}

async function takeFullPageScreenshot(
    context: BrowserContext,
    url: string,
    outputPath: string,
    waitTime: number
): Promise<void> {
    const page = await context.newPage();
    try {
        await page.goto(url, { waitUntil: "networkidle", timeout: 60000 });

        // Disable animations and transitions to ensure consistent screenshots
        await page.addStyleTag({
            content: `
                *, *::before, *::after {
                    animation-duration: 0s !important;
                    animation-delay: 0s !important;
                    transition-duration: 0s !important;
                    transition-delay: 0s !important;
                }
            `
        });

        // Remove cookie consent popups and banners
        await page.evaluate(() => {
            // Common selectors for cookie consent popups
            const cookieSelectors = [
                // Class-based selectors
                '[class*="cookie-consent"]',
                '[class*="cookie-banner"]',
                '[class*="cookie-notice"]',
                '[class*="cookie-popup"]',
                '[class*="cookie-modal"]',
                '[class*="cookieconsent"]',
                '[class*="CookieConsent"]',
                '[class*="gdpr"]',
                '[class*="GDPR"]',
                '[class*="consent-banner"]',
                '[class*="consent-modal"]',
                '[class*="privacy-banner"]',
                '[class*="privacy-notice"]',
                ".cky-consent-container",
                // ID-based selectors
                '[id*="cookie-consent"]',
                '[id*="cookie-banner"]',
                '[id*="cookie-notice"]',
                '[id*="cookieconsent"]',
                '[id*="CookieConsent"]',
                '[id*="gdpr"]',
                '[id*="consent-banner"]',
                '[id*="onetrust"]',
                '[id*="OneTrust"]',
                // Data attribute selectors
                "[data-cookieconsent]",
                "[data-cookie-consent]",
                "[data-gdpr]",
                // Common cookie consent library elements
                "#onetrust-banner-sdk",
                "#onetrust-consent-sdk",
                ".onetrust-pc-dark-filter",
                "#CybotCookiebotDialog",
                "#CybotCookiebotDialogBodyUnderlay",
                ".cc-window",
                ".cc-banner",
                "#cookiescript_injected",
                ".osano-cm-window",
                "#osano-cm-window",
                ".termly-consent-banner",
                "#termly-consent-banner",
                // Generic modal/overlay selectors that might be cookie-related
                '[aria-label*="cookie"]',
                '[aria-label*="Cookie"]',
                '[aria-label*="consent"]',
                '[aria-label*="Consent"]',
                '[aria-label*="GDPR"]',
                '[aria-label*="privacy"]',
                '[aria-label*="Privacy"]'
            ];

            for (const selector of cookieSelectors) {
                try {
                    const elements = document.querySelectorAll(selector);
                    elements.forEach((el) => el.remove());
                } catch {
                    // Ignore invalid selectors
                }
            }

            // Also remove any fixed/sticky elements at the bottom that might be cookie banners
            const allElements = document.querySelectorAll("*");
            allElements.forEach((el) => {
                const style = window.getComputedStyle(el);
                const rect = el.getBoundingClientRect();
                // Check if element is fixed/sticky at the bottom of the viewport
                if (
                    (style.position === "fixed" || style.position === "sticky") &&
                    rect.bottom >= window.innerHeight - 100 &&
                    rect.height < 300
                ) {
                    // Check if it contains cookie-related text
                    const text = el.textContent?.toLowerCase() || "";
                    if (
                        text.includes("cookie") ||
                        text.includes("consent") ||
                        text.includes("gdpr") ||
                        text.includes("privacy") ||
                        text.includes("accept all") ||
                        text.includes("reject all")
                    ) {
                        el.remove();
                    }
                }
            });
        });

        // Wait for fonts to load
        await page.evaluate(() => document.fonts.ready);

        // Wait for all images to load
        await page.evaluate(() => {
            const images = Array.from(document.querySelectorAll("img"));
            return Promise.all(
                images.map((img) => {
                    if (img.complete) {
                        return Promise.resolve();
                    }
                    return new Promise((resolve) => {
                        img.addEventListener("load", resolve);
                        img.addEventListener("error", resolve);
                        // Timeout after 5 seconds per image
                        setTimeout(resolve, 5000);
                    });
                })
            );
        });

        // Scroll to top to ensure consistent starting position
        await page.evaluate(() => window.scrollTo(0, 0));

        // Wait for client-side rendered components (like Mermaid diagrams) to fully render
        await page.waitForTimeout(waitTime);
        await page.screenshot({ path: outputPath, fullPage: true });
    } finally {
        await page.close();
    }
}

async function compareImages(
    img1Path: string,
    img2Path: string,
    diffPath: string,
    threshold: number
): Promise<{ diffPixels: number; diffPercentage: number }> {
    const img1 = PNG.sync.read(fs.readFileSync(img1Path));
    const img2 = PNG.sync.read(fs.readFileSync(img2Path));

    const width = Math.max(img1.width, img2.width);
    const height = Math.max(img1.height, img2.height);

    const normalizedImg1 = new PNG({ width, height });
    const normalizedImg2 = new PNG({ width, height });

    normalizedImg1.data.fill(255);
    normalizedImg2.data.fill(255);

    PNG.bitblt(img1, normalizedImg1, 0, 0, img1.width, img1.height, 0, 0);
    PNG.bitblt(img2, normalizedImg2, 0, 0, img2.width, img2.height, 0, 0);

    const diff = new PNG({ width, height });

    const diffPixels = pixelmatch(normalizedImg1.data, normalizedImg2.data, diff.data, width, height, {
        threshold,
        includeAA: false // Ignore anti-aliasing differences
    });

    fs.writeFileSync(diffPath, PNG.sync.write(diff));

    const totalPixels = width * height;
    const diffPercentage = (diffPixels / totalPixels) * 100;

    return { diffPixels, diffPercentage };
}

async function processPage(
    pagePath: string,
    domain: string,
    liveBaseUrl: string,
    previewBaseUrl: string,
    outputDir: string,
    threshold: number,
    diffThreshold: number,
    waitTime: number,
    liveContext: BrowserContext,
    previewContext: BrowserContext
): Promise<DiffResult> {
    const sanitizedName = sanitizeFilename(pagePath);
    const liveScreenshotPath = path.join(outputDir, "live", `${sanitizedName}.png`);
    const previewScreenshotPath = path.join(outputDir, "preview", `${sanitizedName}.png`);
    const diffScreenshotPath = path.join(outputDir, "diff", `${sanitizedName}.png`);

    const liveUrl = `${liveBaseUrl}${pagePath}`;
    const previewUrl = `${previewBaseUrl}${pagePath}`;

    const result: DiffResult = {
        page: pagePath,
        domain,
        liveUrl,
        previewUrl,
        liveScreenshot: liveScreenshotPath,
        previewScreenshot: previewScreenshotPath,
        diffScreenshot: null,
        diffPixels: 0,
        diffPercentage: 0,
        hasDiff: false
    };

    try {
        console.log(`  Processing: ${pagePath}`);

        await Promise.all([
            takeFullPageScreenshot(liveContext, liveUrl, liveScreenshotPath, waitTime),
            takeFullPageScreenshot(previewContext, previewUrl, previewScreenshotPath, waitTime)
        ]);

        const { diffPixels, diffPercentage } = await compareImages(
            liveScreenshotPath,
            previewScreenshotPath,
            diffScreenshotPath,
            threshold
        );

        result.diffPixels = diffPixels;
        result.diffPercentage = diffPercentage;
        // Only report as a diff if it exceeds the minimum diff threshold percentage
        result.hasDiff = diffPercentage >= diffThreshold;
        result.diffScreenshot = diffScreenshotPath;

        if (result.hasDiff) {
            console.log(`    DIFF: ${diffPixels} pixels (${diffPercentage.toFixed(2)}%)`);
        } else if (diffPixels > 0) {
            console.log(`    MINOR: ${diffPixels} pixels (${diffPercentage.toFixed(2)}%) - below threshold`);
        } else {
            console.log(`    OK: No visual differences`);
        }
    } catch (error) {
        result.error = error instanceof Error ? error.message : String(error);
        console.error(`    ERROR: ${result.error}`);
    }

    return result;
}

async function runVisualDiffForDomain(
    options: VisualDiffOptions,
    liveBrowser: Browser,
    previewBrowser: Browser
): Promise<CrawlResults> {
    const { liveUrl, previewUrl, outputDir, threshold, diffThreshold, maxPages, maxDiffs, concurrency, waitTime } =
        options;
    const domain = getDomainSlug(liveUrl);

    fs.mkdirSync(path.join(outputDir, "live"), { recursive: true });
    fs.mkdirSync(path.join(outputDir, "preview"), { recursive: true });
    fs.mkdirSync(path.join(outputDir, "diff"), { recursive: true });

    const results: CrawlResults = {
        domain,
        totalPages: 0,
        pagesWithDiffs: 0,
        pagesWithErrors: 0,
        results: []
    };

    const liveContext = await liveBrowser.newContext();
    const previewContext = await previewBrowser.newContext();

    try {
        const setupPage = await previewContext.newPage();
        console.log(`Setting up preview connection: ${previewUrl}`);
        await setupPage.goto(previewUrl, { waitUntil: "networkidle", timeout: 60000 });
        console.log("Preview cookie established");

        const previewBaseUrl = new URL(setupPage.url());
        const previewBaseUrlString = `${previewBaseUrl.protocol}//${previewBaseUrl.hostname}`;
        console.log(`Preview base URL: ${previewBaseUrlString}`);

        const liveBaseUrl = new URL(liveUrl);
        const liveBaseUrlString = `${liveBaseUrl.protocol}//${liveBaseUrl.hostname}`;
        const liveSubpath = liveBaseUrl.pathname !== "/" ? liveBaseUrl.pathname : "";
        console.log(`Live base URL: ${liveBaseUrlString}`);
        if (liveSubpath) {
            console.log(`Live subpath filter: ${liveSubpath}`);
        }

        await setupPage.close();

        const sitemapUrls = await fetchSitemap(liveBaseUrlString, liveContext);

        if (sitemapUrls.length === 0) {
            console.error("No URLs found in sitemap.");
            return results;
        }

        let pagePaths = sitemapUrls.map(extractPathFromUrl);
        pagePaths = [...new Set(pagePaths)];

        // Filter pages to only include those under the subpath (if specified)
        if (liveSubpath) {
            const originalCount = pagePaths.length;
            pagePaths = pagePaths.filter((p) => p.startsWith(liveSubpath));
            console.log(`Filtered to ${pagePaths.length} pages under ${liveSubpath} (from ${originalCount} total)`);
        }

        if (maxPages && maxPages > 0) {
            pagePaths = pagePaths.slice(0, maxPages);
            console.log(`Limited to ${maxPages} pages`);
        }

        console.log(`\nProcessing ${pagePaths.length} pages with concurrency ${concurrency}...\n`);
        results.totalPages = pagePaths.length;

        let earlyExit = false;
        for (let i = 0; i < pagePaths.length; i += concurrency) {
            const batch = pagePaths.slice(i, i + concurrency);
            const batchResults = await Promise.all(
                batch.map((pagePath) =>
                    processPage(
                        pagePath,
                        domain,
                        liveBaseUrlString,
                        previewBaseUrlString,
                        outputDir,
                        threshold,
                        diffThreshold,
                        waitTime,
                        liveContext,
                        previewContext
                    )
                )
            );

            results.results.push(...batchResults);

            for (const result of batchResults) {
                if (result.error) {
                    results.pagesWithErrors++;
                } else if (result.hasDiff) {
                    results.pagesWithDiffs++;
                }
            }

            // Check for early exit if maxDiffs is set
            if (maxDiffs && results.pagesWithDiffs >= maxDiffs) {
                console.log(`\nEarly exit: Found ${results.pagesWithDiffs} pages with diffs (max: ${maxDiffs})`);
                earlyExit = true;
                break;
            }
        }

        if (earlyExit) {
            results.totalPages = results.results.length;
        }
    } finally {
        await liveContext.close();
        await previewContext.close();
    }

    return results;
}

async function runMultiDomainVisualDiff(
    domains: string[],
    previewUrlBase: string,
    outputDir: string,
    threshold: number,
    diffThreshold: number,
    maxPages: number | undefined,
    maxDiffs: number | undefined,
    concurrency: number,
    waitTime: number
): Promise<MultiDomainResults> {
    console.log("Launching browsers...");
    const liveBrowser = await chromium.launch({ headless: true });
    const previewBrowser = await chromium.launch({ headless: true });

    const multiResults: MultiDomainResults = {
        domains: [],
        totalPages: 0,
        totalDiffs: 0,
        totalErrors: 0
    };

    try {
        for (const domain of domains) {
            const normalizedLiveUrl = normalizeUrl(domain);
            const normalizedPreviewUrl = buildPreviewUrl(previewUrlBase, domain);
            const domainSlug = getDomainSlug(domain);
            const domainOutputDir = path.join(outputDir, domainSlug);

            console.log("\n" + "=".repeat(60));
            console.log(`Processing domain: ${domain}`);
            console.log(`Live URL: ${normalizedLiveUrl}`);
            console.log(`Preview URL: ${normalizedPreviewUrl}`);
            console.log(`Output Directory: ${domainOutputDir}`);
            console.log("=".repeat(60) + "\n");

            const results = await runVisualDiffForDomain(
                {
                    liveUrl: normalizedLiveUrl,
                    previewUrl: normalizedPreviewUrl,
                    outputDir: domainOutputDir,
                    threshold,
                    diffThreshold,
                    maxPages,
                    maxDiffs,
                    concurrency,
                    waitTime
                },
                liveBrowser,
                previewBrowser
            );

            multiResults.domains.push(results);
            multiResults.totalPages += results.totalPages;
            multiResults.totalDiffs += results.pagesWithDiffs;
            multiResults.totalErrors += results.pagesWithErrors;

            generateDomainReport(results, domainOutputDir);
        }
    } finally {
        await liveBrowser.close();
        await previewBrowser.close();
    }

    return multiResults;
}

async function runSingleDomainVisualDiff(
    liveUrl: string,
    previewUrl: string,
    outputDir: string,
    threshold: number,
    diffThreshold: number,
    maxPages: number | undefined,
    maxDiffs: number | undefined,
    concurrency: number,
    waitTime: number
): Promise<CrawlResults> {
    console.log("Launching browsers...");
    const liveBrowser = await chromium.launch({ headless: true });
    const previewBrowser = await chromium.launch({ headless: true });

    try {
        const results = await runVisualDiffForDomain(
            {
                liveUrl,
                previewUrl,
                outputDir,
                threshold,
                diffThreshold,
                maxPages,
                maxDiffs,
                concurrency,
                waitTime
            },
            liveBrowser,
            previewBrowser
        );

        return results;
    } finally {
        await liveBrowser.close();
        await previewBrowser.close();
    }
}

function generateHtmlReport(results: CrawlResults, outputDir: string): string {
    const diffsOnly = results.results.filter((r) => r.hasDiff && !r.error);
    diffsOnly.sort((a, b) => b.diffPercentage - a.diffPercentage);
    const errorsOnly = results.results.filter((r) => r.error);

    let html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Visual Diff Report - ${results.domain}</title>
    <style>
        * { box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }
        .header { background: #fff; padding: 20px; border-radius: 8px; margin-bottom: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .header h1 { margin: 0 0 10px 0; }
        .stats { display: flex; gap: 20px; }
        .stat { padding: 10px 20px; background: #f0f0f0; border-radius: 4px; }
        .stat.diff { background: #fff3cd; }
        .stat.error { background: #f8d7da; }
        .stat.ok { background: #d4edda; }
        .page-card { background: #fff; border-radius: 8px; margin-bottom: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); overflow: hidden; }
        .page-header { padding: 15px 20px; background: #f8f9fa; border-bottom: 1px solid #dee2e6; cursor: pointer; }
        .page-header:hover { background: #e9ecef; }
        .page-header h3 { margin: 0; display: flex; justify-content: space-between; align-items: center; }
        .diff-badge { font-size: 14px; padding: 4px 12px; background: #ffc107; border-radius: 20px; }
        .error-badge { font-size: 14px; padding: 4px 12px; background: #dc3545; color: white; border-radius: 20px; }
        .page-content { padding: 20px; display: none; }
        .page-content.open { display: block; }
        .image-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; }
        .image-container { text-align: center; }
        .image-container h4 { margin: 0 0 10px 0; font-size: 14px; color: #666; }
        .image-container img { max-width: 100%; height: auto; border: 1px solid #ddd; border-radius: 4px; cursor: pointer; }
        .error-message { color: #dc3545; padding: 10px; background: #f8d7da; border-radius: 4px; }
        .modal { display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.9); z-index: 1000; }
        .modal.open { display: flex; justify-content: center; align-items: center; }
        .modal img { max-width: 95%; max-height: 95%; object-fit: contain; }
        .modal-close { position: absolute; top: 20px; right: 30px; color: white; font-size: 40px; cursor: pointer; }
        .no-diffs { text-align: center; padding: 40px; color: #28a745; font-size: 18px; }
    </style>
</head>
<body>
    <div class="header">
        <h1>Visual Diff Report - ${results.domain}</h1>
        <div class="stats">
            <div class="stat">Total Pages: ${results.totalPages}</div>
            <div class="stat ${results.pagesWithDiffs > 0 ? "diff" : "ok"}">Pages with Diffs: ${results.pagesWithDiffs}</div>
            <div class="stat ${results.pagesWithErrors > 0 ? "error" : "ok"}">Pages with Errors: ${results.pagesWithErrors}</div>
        </div>
    </div>
`;

    if (results.pagesWithDiffs === 0 && results.pagesWithErrors === 0) {
        html += `<div class="no-diffs">All pages match! No visual differences detected.</div>`;
    } else {
        for (const result of diffsOnly) {
            const liveImg = `live/${path.basename(result.liveScreenshot)}`;
            const previewImg = `preview/${path.basename(result.previewScreenshot)}`;
            const diffImg = result.diffScreenshot ? `diff/${path.basename(result.diffScreenshot)}` : "";

            html += `
    <div class="page-card">
        <div class="page-header" onclick="this.nextElementSibling.classList.toggle('open')">
            <h3>${result.page} <span class="diff-badge">${result.diffPercentage.toFixed(2)}% diff</span></h3>
        </div>
        <div class="page-content">
            <div class="image-grid">
                <div class="image-container">
                    <h4>Live</h4>
                    <img src="${liveImg}" alt="Live screenshot" onclick="openModal(this.src)">
                </div>
                <div class="image-container">
                    <h4>Preview</h4>
                    <img src="${previewImg}" alt="Preview screenshot" onclick="openModal(this.src)">
                </div>
                <div class="image-container">
                    <h4>Diff</h4>
                    ${diffImg ? `<img src="${diffImg}" alt="Diff" onclick="openModal(this.src)">` : "<p>N/A</p>"}
                </div>
            </div>
        </div>
    </div>`;
        }

        for (const result of errorsOnly) {
            html += `
    <div class="page-card">
        <div class="page-header">
            <h3>${result.page} <span class="error-badge">Error</span></h3>
        </div>
        <div class="page-content open">
            <div class="error-message">${result.error}</div>
        </div>
    </div>`;
        }
    }

    html += `
    <div class="modal" id="modal" onclick="closeModal()">
        <span class="modal-close">&times;</span>
        <img id="modal-img" src="" alt="Full size">
    </div>
    <script>
        function openModal(src) {
            document.getElementById('modal-img').src = src;
            document.getElementById('modal').classList.add('open');
        }
        function closeModal() {
            document.getElementById('modal').classList.remove('open');
        }
        document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });
    </script>
</body>
</html>`;

    const htmlPath = path.join(outputDir, "report.html");
    fs.writeFileSync(htmlPath, html);
    return htmlPath;
}

function generateDomainReport(results: CrawlResults, outputDir: string): string {
    const reportPath = path.join(outputDir, "report.json");
    fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));

    let markdown = `# Visual Diff Report - ${results.domain}\n\n`;
    markdown += `**Total Pages:** ${results.totalPages}\n`;
    markdown += `**Pages with Diffs:** ${results.pagesWithDiffs}\n`;
    markdown += `**Pages with Errors:** ${results.pagesWithErrors}\n\n`;

    if (results.pagesWithDiffs === 0 && results.pagesWithErrors === 0) {
        markdown += `All pages match! No visual differences detected.\n`;
    } else {
        if (results.pagesWithDiffs > 0) {
            markdown += `## Pages with Visual Differences\n\n`;
            const diffsOnly = results.results.filter((r) => r.hasDiff && !r.error);
            diffsOnly.sort((a, b) => b.diffPercentage - a.diffPercentage);

            for (const result of diffsOnly) {
                markdown += `### ${result.page}\n`;
                markdown += `- **Diff Pixels:** ${result.diffPixels}\n`;
                markdown += `- **Diff Percentage:** ${result.diffPercentage.toFixed(2)}%\n`;
                markdown += `- **Live Screenshot:** \`${path.basename(result.liveScreenshot)}\`\n`;
                markdown += `- **Preview Screenshot:** \`${path.basename(result.previewScreenshot)}\`\n`;
                markdown += `- **Diff Image:** \`${result.diffScreenshot ? path.basename(result.diffScreenshot) : "N/A"}\`\n\n`;
            }
        }

        if (results.pagesWithErrors > 0) {
            markdown += `## Pages with Errors\n\n`;
            const errorsOnly = results.results.filter((r) => r.error);

            for (const result of errorsOnly) {
                markdown += `### ${result.page}\n`;
                markdown += `- **Error:** ${result.error}\n\n`;
            }
        }
    }

    const markdownPath = path.join(outputDir, "report.md");
    fs.writeFileSync(markdownPath, markdown);

    const htmlPath = generateHtmlReport(results, outputDir);

    console.log("\n" + "=".repeat(60));
    console.log(`VISUAL DIFF SUMMARY - ${results.domain}`);
    console.log("=".repeat(60));
    console.log(`Total pages: ${results.totalPages}`);
    console.log(`Pages with diffs: ${results.pagesWithDiffs}`);
    console.log(`Pages with errors: ${results.pagesWithErrors}`);
    console.log(`\nReports saved to:`);
    console.log(`  - ${reportPath}`);
    console.log(`  - ${markdownPath}`);
    console.log(`  - ${htmlPath}`);

    if (results.pagesWithDiffs > 0) {
        console.log(`\nPages with visual differences:`);
        const diffsOnly = results.results.filter((r) => r.hasDiff && !r.error);
        diffsOnly.sort((a, b) => b.diffPercentage - a.diffPercentage);
        for (const result of diffsOnly) {
            console.log(`  - ${result.page} (${result.diffPercentage.toFixed(2)}% diff)`);
        }
    }

    return htmlPath;
}

function generateMultiDomainSummary(results: MultiDomainResults, outputDir: string): void {
    const summaryPath = path.join(outputDir, "summary.json");
    fs.writeFileSync(summaryPath, JSON.stringify(results, null, 2));

    let markdown = `# Visual Diff Summary\n\n`;
    markdown += `**Total Domains:** ${results.domains.length}\n`;
    markdown += `**Total Pages:** ${results.totalPages}\n`;
    markdown += `**Total Diffs:** ${results.totalDiffs}\n`;
    markdown += `**Total Errors:** ${results.totalErrors}\n\n`;

    markdown += `## Domain Results\n\n`;
    for (const domain of results.domains) {
        markdown += `### ${domain.domain}\n`;
        markdown += `- Pages: ${domain.totalPages}\n`;
        markdown += `- Diffs: ${domain.pagesWithDiffs}\n`;
        markdown += `- Errors: ${domain.pagesWithErrors}\n\n`;
    }

    const markdownPath = path.join(outputDir, "summary.md");
    fs.writeFileSync(markdownPath, markdown);

    console.log("\n" + "=".repeat(60));
    console.log("MULTI-DOMAIN VISUAL DIFF SUMMARY");
    console.log("=".repeat(60));
    console.log(`Total domains: ${results.domains.length}`);
    console.log(`Total pages: ${results.totalPages}`);
    console.log(`Total diffs: ${results.totalDiffs}`);
    console.log(`Total errors: ${results.totalErrors}`);
    console.log(`\nSummary saved to:`);
    console.log(`  - ${summaryPath}`);
    console.log(`  - ${markdownPath}`);
}

function printUsage(): void {
    console.log(`
Visual Diff CLI - Compare live docs site with preview deployment

Usage:
  pnpm visual-diff [live-url] [preview-url] [options]
  pnpm visual-diff --domains "domain1,domain2" --preview "preview-url" [options]

If URLs are not provided, the tool will prompt for them interactively.

Arguments:
  live-url      The live docs site URL (e.g., buildwithfern.com/learn or https://buildwithfern.com/learn)
                The https:// prefix is optional and will be added automatically.
  preview-url   The preview URL (e.g., https://prodferndocscom-git-xxx.vercel.app)
                The /api/fern-docs/preview?host=... path will be automatically added.

Options:
  --domains, -d       Comma-separated list of domains to test (for multi-domain mode)
  --preview, -p       Preview URL base (required for multi-domain mode)
  --output, -o        Output directory for screenshots and reports (default: ./visual-diff-output)
  --threshold, -t     Pixel matching threshold 0-1 (default: 0.1)
  --diff-threshold    Minimum diff percentage to report as a visual difference (default: 1.0)
                      Diffs below this percentage are ignored as noise (anti-aliasing, fonts, etc.)
  --max-pages, -m     Maximum number of pages to compare per domain (default: all)
  --max-diffs         Stop early after finding this many pages with diffs (for CI use)
  --concurrency, -c   Number of pages to process in parallel (default: 3, "auto" for CPU cores, "auto2x" for 2x CPU cores)
  --wait-time, -w     Time in ms to wait after page load for client-side rendering (default: 3000)
  --fail-on-diff      Exit with code 1 if diffs are found (for CI use)
  --open              Open the HTML report in browser after completion
  --help, -h          Show this help message

Examples:
  # Interactive mode
  pnpm visual-diff

  # Single domain mode
  pnpm visual-diff buildwithfern.com/learn "https://preview.vercel.app"
  pnpm visual-diff buildwithfern.com/learn "https://preview-url" --max-pages 10 --open

  # Multi-domain mode (for CI)
  pnpm visual-diff --domains "buildwithfern.com/learn,docs.cohere.com" --preview "https://preview.vercel.app" --max-pages 100 --concurrency auto
`);
}

async function main(): Promise<void> {
    const args = process.argv.slice(2);

    if (args.includes("--help") || args.includes("-h")) {
        printUsage();
        process.exit(0);
    }

    let outputDir = "./visual-diff-output";
    let threshold = 0.1;
    let diffThreshold = 1.0; // Default 1% minimum diff to report (filters out anti-aliasing noise)
    let maxPages: number | undefined;
    let maxDiffs: number | undefined;
    let concurrency = 3;
    let waitTime = 3000; // Default 3 seconds for client-side rendered components
    let failOnDiff = false;
    let openReport = false;
    let domains: string[] = [];
    let previewUrlBase = "";

    failOnDiff = args.includes("--fail-on-diff");
    openReport = args.includes("--open");

    // Parse arguments
    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        const nextArg = args[i + 1];

        if ((arg === "--domains" || arg === "-d") && nextArg) {
            domains = nextArg.split(",").map((d) => d.trim());
            i++;
        } else if ((arg === "--preview" || arg === "-p") && nextArg) {
            previewUrlBase = nextArg;
            i++;
        } else if ((arg === "--output" || arg === "-o") && nextArg) {
            outputDir = nextArg;
            i++;
        } else if ((arg === "--threshold" || arg === "-t") && nextArg) {
            threshold = parseFloat(nextArg);
            i++;
        } else if (arg === "--diff-threshold" && nextArg) {
            diffThreshold = parseFloat(nextArg);
            i++;
        } else if ((arg === "--max-pages" || arg === "-m") && nextArg) {
            maxPages = parseInt(nextArg, 10);
            i++;
        } else if (arg === "--max-diffs" && nextArg) {
            maxDiffs = parseInt(nextArg, 10);
            i++;
        } else if ((arg === "--concurrency" || arg === "-c") && nextArg) {
            if (nextArg === "auto") {
                concurrency = os.cpus().length;
                console.log(`Using auto concurrency: ${concurrency} CPU cores`);
            } else if (nextArg === "auto2x") {
                concurrency = os.cpus().length * 2;
                console.log(`Using auto2x concurrency: ${concurrency} (2x CPU cores)`);
            } else {
                concurrency = parseInt(nextArg, 10);
            }
            i++;
        } else if ((arg === "--wait-time" || arg === "-w") && nextArg) {
            waitTime = parseInt(nextArg, 10);
            i++;
        }
    }

    // Multi-domain mode
    if (domains.length > 0) {
        if (!previewUrlBase) {
            console.error("Error: --preview is required when using --domains");
            process.exit(1);
        }

        console.log("Visual Diff CLI - Multi-Domain Mode");
        console.log("=".repeat(60));
        console.log(`Domains: ${domains.join(", ")}`);
        console.log(`Preview URL Base: ${previewUrlBase}`);
        console.log(`Output Directory: ${outputDir}`);
        console.log(`Pixel Threshold: ${threshold}`);
        console.log(`Diff Threshold: ${diffThreshold}% (minimum diff to report)`);
        console.log(`Max Pages: ${maxPages || "all"}`);
        console.log(`Max Diffs (early exit): ${maxDiffs || "disabled"}`);
        console.log(`Concurrency: ${concurrency}`);
        console.log(`Wait Time: ${waitTime}ms`);
        console.log("=".repeat(60) + "\n");

        const results = await runMultiDomainVisualDiff(
            domains,
            previewUrlBase,
            outputDir,
            threshold,
            diffThreshold,
            maxPages,
            maxDiffs,
            concurrency,
            waitTime
        );

        generateMultiDomainSummary(results, outputDir);

        if (failOnDiff && (results.totalDiffs > 0 || results.totalErrors > 0)) {
            process.exit(1);
        }

        return;
    }

    // Single domain mode (original behavior)
    const nonFlagArgs = args.filter(
        (arg) => !arg.startsWith("-") && !args.includes(`--${arg}`) && !args.includes(`-${arg}`)
    );

    // Filter out values that follow flags
    const flagValues = new Set<string>();
    for (let i = 0; i < args.length; i++) {
        if (args[i].startsWith("-") && args[i + 1] && !args[i + 1].startsWith("-")) {
            flagValues.add(args[i + 1]);
        }
    }
    const positionalArgs = nonFlagArgs.filter((arg) => !flagValues.has(arg));

    let liveUrl: string;
    let previewUrl: string;
    const isInteractive = positionalArgs.length < 2;

    if (isInteractive) {
        console.log("Visual Diff CLI - Interactive Mode");
        console.log("=".repeat(60) + "\n");

        if (positionalArgs.length >= 1) {
            liveUrl = positionalArgs[0];
            console.log(`Live URL: ${liveUrl}`);
        } else {
            liveUrl = await prompt("Enter the live docs site URL (e.g., buildwithfern.com/learn): ");
            if (!liveUrl) {
                console.error("Error: Live URL is required.");
                process.exit(1);
            }
        }

        previewUrl = await prompt("Enter the preview URL (e.g., https://preview.vercel.app): ");
        if (!previewUrl) {
            console.error("Error: Preview URL is required.");
            process.exit(1);
        }

        const maxPagesInput = await prompt("Maximum pages to compare (press Enter for all): ");
        if (maxPagesInput) {
            maxPages = parseInt(maxPagesInput, 10);
        }

        const outputDirInput = await prompt(`Output directory (press Enter for ${outputDir}): `);
        if (outputDirInput) {
            outputDir = outputDirInput;
        }

        console.log("");
    } else {
        liveUrl = positionalArgs[0];
        previewUrl = positionalArgs[1];
    }

    const normalizedLiveUrl = normalizeUrl(liveUrl);
    const normalizedPreviewUrl = buildPreviewUrl(previewUrl, liveUrl);

    console.log("Visual Diff CLI");
    console.log("=".repeat(60));
    console.log(`Live URL: ${normalizedLiveUrl}`);
    console.log(`Preview URL: ${normalizedPreviewUrl}`);
    console.log(`Output Directory: ${outputDir}`);
    console.log(`Pixel Threshold: ${threshold}`);
    console.log(`Diff Threshold: ${diffThreshold}% (minimum diff to report)`);
    console.log(`Max Pages: ${maxPages || "all"}`);
    console.log(`Max Diffs (early exit): ${maxDiffs || "disabled"}`);
    console.log(`Concurrency: ${concurrency}`);
    console.log(`Wait Time: ${waitTime}ms`);
    console.log("=".repeat(60) + "\n");

    const results = await runSingleDomainVisualDiff(
        normalizedLiveUrl,
        normalizedPreviewUrl,
        outputDir,
        threshold,
        diffThreshold,
        maxPages,
        maxDiffs,
        concurrency,
        waitTime
    );

    const htmlPath = generateDomainReport(results, outputDir);

    if (openReport) {
        const { exec } = await import("child_process");
        const openCommand =
            process.platform === "darwin" ? "open" : process.platform === "win32" ? "start" : "xdg-open";
        exec(`${openCommand} "${htmlPath}"`);
        console.log(`\nOpening report in browser: ${htmlPath}`);
    }

    if (failOnDiff && (results.pagesWithDiffs > 0 || results.pagesWithErrors > 0)) {
        process.exit(1);
    }
}

main().catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
});
