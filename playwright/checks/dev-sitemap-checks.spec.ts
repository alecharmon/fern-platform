import { expect, test } from "@playwright/test";

/**
 * Verifies that every page in the sitemap of customer dev sites returns 200.
 *
 * Runs in Checkly on a schedule against already-deployed dev sites.
 * The sites are published by the GitHub Actions fern-dev-tests workflow
 * (fern-dev-tests/tests/sitemap-customer-sites.spec.ts).
 *
 * Covers:
 *   - square-smoke-test.docs.dev.buildwithfern.com
 *   - merge.docs.dev.buildwithfern.com
 *   - docs-new.merge.usefern.com (Merge custom domain)
 */

interface DevSite {
    name: string;
    domain: string;
}

const DEV_SITES: DevSite[] = [
    { name: "square", domain: "square-smoke-test.docs.dev.buildwithfern.com" },
    { name: "merge", domain: "merge.docs.dev.buildwithfern.com" },
    { name: "merge-custom-domain", domain: "docs-new.merge.usefern.com" }
];

const BATCH_SIZE = 50;
const PER_SITE_TIMEOUT_MS = 10 * 60_000; // 10 minutes per site

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

for (const site of DEV_SITES) {
    test(`${site.name}: all sitemap pages return 200`, async ({ request }) => {
        test.setTimeout(PER_SITE_TIMEOUT_MS + 30_000); // pad for sitemap fetch + reporting

        const deadline = Date.now() + PER_SITE_TIMEOUT_MS;
        const siteUrl = `https://${site.domain}`;

        const sitemapResp = await request.get(`${siteUrl}/sitemap.xml`, { timeout: 15_000 });
        expect(sitemapResp.status(), `sitemap.xml returned ${sitemapResp.status()} for ${site.domain}`).toBe(200);

        const xml = await sitemapResp.text();
        const urls = parseSitemapLocs(xml);
        console.log(`Parsed ${urls.length} sitemap entries from ${siteUrl}/sitemap.xml`);
        expect(urls.length, `Expected at least one page in sitemap for ${site.domain}`).toBeGreaterThan(0);

        const failures: string[] = [];
        let checked = 0;
        let timedOut = false;

        for (let i = 0; i < urls.length; i += BATCH_SIZE) {
            if (Date.now() >= deadline) {
                timedOut = true;
                break;
            }

            const batch = urls.slice(i, i + BATCH_SIZE);
            await Promise.all(
                batch.map((url) =>
                    test.step(`check ${url}`, async () => {
                        try {
                            const resp = await request.get(url, { timeout: 10_000, maxRedirects: 5 });
                            if (resp.status() !== 200) {
                                failures.push(`${url}: status ${resp.status()}`);
                            }
                        } catch (e: unknown) {
                            const msg = e instanceof Error ? e.message : String(e);
                            failures.push(`${url}: ${msg}`);
                        }
                        checked++;
                    })
                )
            );
        }

        if (timedOut) {
            console.log(
                `Hit ${PER_SITE_TIMEOUT_MS / 60_000}min deadline after checking ${checked}/${urls.length} pages`
            );
        }

        expect(
            failures,
            `${failures.length} of ${checked} checked page(s) returned non-200 (${urls.length} total in sitemap)${timedOut ? " [timed out]" : ""}:\n${failures.join("\n")}`
        ).toHaveLength(0);
    });
}
