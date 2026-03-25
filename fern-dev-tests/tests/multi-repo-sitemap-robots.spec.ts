import { expect, test } from "@playwright/test";

/**
 * Multi-repo sitemap and robots.txt checks.
 *
 * Verifies that sitemap.xml and robots.txt are correctly served at each
 * subpath level for multi-repo docs domains:
 *
 *   - fruits.docs.dev.buildwithfern.com (base should 404 — no root repo published)
 *   - fruits.docs.dev.buildwithfern.com/apple
 *   - fruits.docs.dev.buildwithfern.com/apple/cosmic-crisp
 *   - multi-repo-domain.docs.buildwithfern.com (base)
 *   - multi-repo-domain.docs.buildwithfern.com/nemo
 */

const FRUITS_DOMAIN = "https://fruits.docs.dev.buildwithfern.com";
const MULTI_REPO_DOMAIN = "https://multi-repo-domain.docs.buildwithfern.com";

function parseSitemapLocs(xml: string): string[] {
    const locs: string[] = [];
    const urlPattern = /<url>([\s\S]*?)<\/url>/g;
    let match;
    while ((match = urlPattern.exec(xml)) !== null) {
        const locMatch = /<loc>(.*?)<\/loc>/.exec(match[1]!);
        if (locMatch) {
            locs.push(locMatch[1]!);
        }
    }
    return locs;
}

// ── fruits.docs.dev.buildwithfern.com ────────────────────────────────

test.describe("fruits domain — base (no root repo published)", () => {
    test("base sitemap.xml returns 404", async ({ request }) => {
        const response = await request.get(`${FRUITS_DOMAIN}/sitemap.xml`);
        expect(response.status()).toBe(404);
    });

    test("base robots.txt returns 404", async ({ request }) => {
        const response = await request.get(`${FRUITS_DOMAIN}/robots.txt`);
        expect(response.status()).toBe(404);
    });
});

test.describe("fruits domain — /apple subpath", () => {
    test("sitemap.xml returns 200 with XML content", async ({ request }) => {
        const response = await request.get(`${FRUITS_DOMAIN}/apple/sitemap.xml`);
        expect(response.status()).toBe(200);
        const contentType = response.headers()["content-type"] ?? "";
        expect(contentType).toContain("xml");
    });

    test("sitemap.xml contains at least one URL", async ({ request }) => {
        const response = await request.get(`${FRUITS_DOMAIN}/apple/sitemap.xml`);
        const xml = await response.text();
        const urls = parseSitemapLocs(xml);
        console.log(`fruits/apple sitemap entries: ${urls.length}`);
        expect(urls.length, "Expected at least one page in /apple sitemap").toBeGreaterThan(0);
    });

    test("robots.txt returns 200", async ({ request }) => {
        const response = await request.get(`${FRUITS_DOMAIN}/apple/robots.txt`);
        expect(response.status()).toBe(200);
    });
});

test.describe("fruits domain — /apple/cosmic-crisp subpath", () => {
    test("sitemap.xml returns 200 with XML content", async ({ request }) => {
        const response = await request.get(`${FRUITS_DOMAIN}/apple/cosmic-crisp/sitemap.xml`);
        expect(response.status()).toBe(200);
        const contentType = response.headers()["content-type"] ?? "";
        expect(contentType).toContain("xml");
    });

    test("sitemap.xml contains at least one URL", async ({ request }) => {
        const response = await request.get(`${FRUITS_DOMAIN}/apple/cosmic-crisp/sitemap.xml`);
        const xml = await response.text();
        const urls = parseSitemapLocs(xml);
        console.log(`fruits/apple/cosmic-crisp sitemap entries: ${urls.length}`);
        expect(urls.length, "Expected at least one page in /apple/cosmic-crisp sitemap").toBeGreaterThan(0);
    });

    test("robots.txt returns 200", async ({ request }) => {
        const response = await request.get(`${FRUITS_DOMAIN}/apple/cosmic-crisp/robots.txt`);
        expect(response.status()).toBe(200);
    });
});

// ── multi-repo-domain.docs.buildwithfern.com ─────────────────────────

test.describe("multi-repo-domain — base", () => {
    test("sitemap.xml returns 200 with XML content", async ({ request }) => {
        const response = await request.get(`${MULTI_REPO_DOMAIN}/sitemap.xml`);
        expect(response.status()).toBe(200);
        const contentType = response.headers()["content-type"] ?? "";
        expect(contentType).toContain("xml");
    });

    test("sitemap.xml contains at least one URL", async ({ request }) => {
        const response = await request.get(`${MULTI_REPO_DOMAIN}/sitemap.xml`);
        const xml = await response.text();
        const urls = parseSitemapLocs(xml);
        console.log(`multi-repo-domain base sitemap entries: ${urls.length}`);
        expect(urls.length, "Expected at least one page in base sitemap").toBeGreaterThan(0);
    });

    test("robots.txt returns 200", async ({ request }) => {
        const response = await request.get(`${MULTI_REPO_DOMAIN}/robots.txt`);
        expect(response.status()).toBe(200);
    });

    test("robots.txt contains Sitemap directive", async ({ request }) => {
        const response = await request.get(`${MULTI_REPO_DOMAIN}/robots.txt`);
        const body = await response.text();
        expect(body).toContain("Sitemap:");
    });
});

test.describe("multi-repo-domain — /nemo subpath", () => {
    test("sitemap.xml returns 200 with XML content", async ({ request }) => {
        const response = await request.get(`${MULTI_REPO_DOMAIN}/nemo/sitemap.xml`);
        expect(response.status()).toBe(200);
        const contentType = response.headers()["content-type"] ?? "";
        expect(contentType).toContain("xml");
    });

    test("sitemap.xml contains at least one URL", async ({ request }) => {
        const response = await request.get(`${MULTI_REPO_DOMAIN}/nemo/sitemap.xml`);
        const xml = await response.text();
        const urls = parseSitemapLocs(xml);
        console.log(`multi-repo-domain/nemo sitemap entries: ${urls.length}`);
        expect(urls.length, "Expected at least one page in /nemo sitemap").toBeGreaterThan(0);
    });

    test("robots.txt returns 200", async ({ request }) => {
        const response = await request.get(`${MULTI_REPO_DOMAIN}/nemo/robots.txt`);
        expect(response.status()).toBe(200);
    });
});
