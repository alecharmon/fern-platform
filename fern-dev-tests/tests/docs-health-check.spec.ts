import { expect, test } from "@playwright/test";

/**
 * Health check tests for docs sites deployed to dev.
 *
 * These tests use plain HTTP requests (no browser, no screenshots) to verify
 * that docs sites are up and returning expected responses.
 *
 * To add new sites, add entries to the SITES array below.
 * To add new health check patterns, add new test cases below.
 */

const SITES = [
    {
        name: "multi-repo-domain",
        url: "https://multi-repo-domain.docs.dev.buildwithfern.com"
    },
    {
        name: "merge",
        url: "https://merge.docs.dev.buildwithfern.com"
    },
    {
        name: "merge-custom-domain",
        url: "https://docs-new.merge.usefern.com"
    }
];

for (const site of SITES) {
    test.describe(`${site.name} health checks`, () => {
        test("front page returns 200", async ({ request }) => {
            const response = await request.get(site.url);
            expect(response.status()).toBe(200);
        });

        test("sitemap.xml returns 200 with XML content", async ({ request }) => {
            const response = await request.get(`${site.url}/sitemap.xml`);
            expect(response.status()).toBe(200);
            const contentType = response.headers()["content-type"] ?? "";
            expect(contentType).toContain("xml");
        });

        test("robots.txt returns 200", async ({ request }) => {
            const response = await request.get(`${site.url}/robots.txt`);
            expect(response.status()).toBe(200);
        });
    });
}
