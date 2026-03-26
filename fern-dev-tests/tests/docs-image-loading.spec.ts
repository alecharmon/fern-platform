import { expect, test } from "@playwright/test";

/**
 * Verifies that user-uploaded images in docs markdown pages load correctly (HTTP 200).
 *
 * For each configured site, this test:
 *   1. Fetches the sitemap to discover all page URLs
 *   2. Visits a sample of pages using Playwright
 *   3. Extracts all <img> elements whose `src` points to files.buildwithfern.com
 *      (the CDN for user-uploaded doc assets)
 *   4. HEAD-requests each unique image URL and asserts a 200 response
 *
 * This catches broken image references caused by failed uploads, deleted assets,
 * or CDN misconfigurations.
 */

const SITES = [
    {
        name: "smoke-test-dev",
        sitemapUrl: "https://smoke-test-dev.docs.dev.buildwithfern.com/sitemap.xml",
        /** Max pages to sample from the sitemap (keeps runtime bounded). */
        maxPages: 10
    }
];

/** Extract page URLs from a sitemap XML string. */
function parseSitemapLocs(xml: string): string[] {
    const locs: string[] = [];
    const urlPattern = /<url>([\s\S]*?)<\/url>/g;
    let match;
    while ((match = urlPattern.exec(xml)) !== null) {
        const locMatch = /<loc>(.*?)<\/loc>/.exec(match[1]!);
        if (locMatch?.[1]) {
            locs.push(locMatch[1]);
        }
    }
    return locs;
}

for (const site of SITES) {
    test.describe(`${site.name} — user-uploaded image loading`, () => {
        test(`all user-uploaded images return 200`, async ({ page, request }) => {
            // 1. Fetch the sitemap
            const sitemapResponse = await request.get(site.sitemapUrl);
            if (sitemapResponse.status() !== 200) {
                console.log(`Skipping ${site.name}: sitemap returned ${sitemapResponse.status()}`);
                test.skip(true, `Sitemap not available (${sitemapResponse.status()})`);
                return;
            }

            const sitemapXml = await sitemapResponse.text();
            const allPageUrls = parseSitemapLocs(sitemapXml);
            console.log(`${site.name}: found ${allPageUrls.length} pages in sitemap`);

            if (allPageUrls.length === 0) {
                console.log(`Skipping ${site.name}: no pages found in sitemap`);
                test.skip(true, "No pages in sitemap");
                return;
            }

            // 2. Sample pages (take first N to keep the test fast)
            const pagesToCheck = allPageUrls.slice(0, site.maxPages);
            console.log(`${site.name}: checking ${pagesToCheck.length} pages for images`);

            // 3. Visit each page and collect user-uploaded image URLs
            const imageUrls = new Set<string>();

            for (const pageUrl of pagesToCheck) {
                try {
                    await page.goto(pageUrl, { waitUntil: "domcontentloaded", timeout: 30_000 });

                    // Extract all img src attributes that point to the Fern files CDN
                    const srcs = await page.evaluate(() => {
                        const imgs = Array.from(document.querySelectorAll("img"));
                        return imgs
                            .map((img) => img.src)
                            .filter((src) => src.includes("files.buildwithfern.com") || src.includes("/_files/"));
                    });

                    for (const src of srcs) {
                        imageUrls.add(src);
                    }
                } catch (err) {
                    console.log(`Warning: failed to load page ${pageUrl}: ${err}`);
                }
            }

            console.log(`${site.name}: found ${imageUrls.size} unique user-uploaded images`);

            if (imageUrls.size === 0) {
                console.log(`${site.name}: no user-uploaded images found — skipping`);
                test.skip(true, "No user-uploaded images found on sampled pages");
                return;
            }

            // 4. Verify each image URL returns 200
            const failures: { url: string; status: number; error?: string }[] = [];

            for (const imageUrl of imageUrls) {
                try {
                    const response = await request.head(imageUrl);
                    if (response.status() !== 200) {
                        failures.push({ url: imageUrl, status: response.status() });
                    }
                } catch (err) {
                    failures.push({ url: imageUrl, status: 0, error: String(err) });
                }
            }

            if (failures.length > 0) {
                console.log(`${site.name}: ${failures.length} broken image(s):`);
                for (const f of failures) {
                    console.log(`  ${f.status} ${f.url}${f.error ? ` (${f.error})` : ""}`);
                }
            }

            expect(failures, `Broken images on ${site.name}`).toHaveLength(0);
        });
    });
}
