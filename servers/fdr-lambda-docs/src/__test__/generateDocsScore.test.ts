import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { generateDocsScore, getHealthIssues } from "../services/generateDocsScore";

describe("generateDocsScore", () => {
    const mockFetch = vi.fn();

    beforeEach(() => {
        vi.stubGlobal("fetch", mockFetch);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("should fetch sitemap and process pages in batches", async () => {
        const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
            <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
                <url><loc>https://example.com/page1</loc></url>
                <url><loc>https://example.com/page2</loc></url>
                <url><loc>https://example.com/page3</loc></url>
            </urlset>`;

        // HTML with title but missing meta description and og:image = 2 issues per page
        const pageHtml = "<html><head><title>Test Page</title></head><body>Content</body></html>";

        mockFetch.mockImplementation((url: string) => {
            if (url.includes("sitemap.xml")) {
                return Promise.resolve({
                    ok: true,
                    text: () => Promise.resolve(sitemapXml)
                });
            }
            return Promise.resolve({
                ok: true,
                text: () => Promise.resolve(pageHtml)
            });
        });

        const result = await generateDocsScore("example.com");

        // Each page has 2 SEO issues (missing meta description - high, missing og:image - medium)
        // 3 pages * 1 high issue = 3 high issues
        // 3 pages * 1 medium issue = 3 medium issues
        expect(result.issueCounts.high).toBe(3);
        expect(result.issueCounts.medium).toBe(3);
        expect(result.issues.length).toBe(6);
        // 1 sitemap + 3 pages fetched
        expect(mockFetch).toHaveBeenCalledTimes(4);
    });

    it("should handle empty sitemap", async () => {
        const emptySitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
            <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
            </urlset>`;

        mockFetch.mockResolvedValue({
            ok: true,
            text: () => Promise.resolve(emptySitemapXml)
        });

        const result = await generateDocsScore("example.com");

        expect(result.issueCounts.high).toBe(1);
        expect(result.issues).toHaveLength(1);
        expect(result.issues[0]?.issueType).toBe("Empty Sitemap");
    });

    it("should handle sitemap fetch error", async () => {
        mockFetch.mockResolvedValue({
            ok: false,
            status: 404,
            statusText: "Not Found"
        });

        const result = await generateDocsScore("example.com");

        expect(result.issueCounts.high).toBe(1);
        expect(result.issues).toHaveLength(1);
        expect(result.issues[0]?.issueType).toBe("Scraping Error");
    });

    it("should handle page fetch errors gracefully", async () => {
        const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
            <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
                <url><loc>https://example.com/page1</loc></url>
                <url><loc>https://example.com/page2</loc></url>
            </urlset>`;

        mockFetch.mockImplementation((url: string) => {
            if (url.includes("sitemap.xml")) {
                return Promise.resolve({
                    ok: true,
                    text: () => Promise.resolve(sitemapXml)
                });
            }
            if (url.includes("page1")) {
                return Promise.resolve({
                    ok: false,
                    status: 500,
                    statusText: "Internal Server Error"
                });
            }
            // page2: empty HTML has 2 SEO issues (missing meta description, missing og:image)
            return Promise.resolve({
                ok: true,
                text: () => Promise.resolve("<html></html>")
            });
        });

        const result = await generateDocsScore("example.com");

        // page1: 1 high issue (fetch error), page2: 1 high (missing description) + 1 medium (missing og:image)
        expect(result.issueCounts.high).toBe(2); // fetch error + missing description
        expect(result.issueCounts.medium).toBe(1); // missing og:image
        const issueTypes = result.issues.map((i) => i.issueType);
        expect(issueTypes).toContain("Fetch Error");
    });

    it("should respect batch size parameter", async () => {
        const urls = Array.from({ length: 25 }, (_, i) => `<url><loc>https://example.com/page${i}</loc></url>`);
        const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
            <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
                ${urls.join("\n")}
            </urlset>`;

        mockFetch.mockImplementation((url: string) => {
            if (url.includes("sitemap.xml")) {
                return Promise.resolve({
                    ok: true,
                    text: () => Promise.resolve(sitemapXml)
                });
            }
            // Empty HTML has 2 SEO issues (missing meta description, missing og:image)
            return Promise.resolve({
                ok: true,
                text: () => Promise.resolve("<html></html>")
            });
        });

        const result = await generateDocsScore("example.com", 5);

        // Each page has 2 SEO issues: 1 high + 1 medium
        expect(result.issueCounts.high).toBe(25);
        expect(result.issueCounts.medium).toBe(25);
        // 1 sitemap + 25 pages fetched
        expect(mockFetch).toHaveBeenCalledTimes(26);
    });
});

describe("getHealthIssues", () => {
    it("should collect issues with correct severity levels", () => {
        // HTML with title but missing meta description (high) and og:image (medium) = 2 issues
        const html = "<html><head><title>Test</title></head><body>Content</body></html>";
        const result = getHealthIssues(html, "https://example.com/page");

        expect(result.url).toBe("https://example.com/page");
        expect(result.issues.length).toBe(2);

        const highIssues = result.issues.filter((i) => i.severity === "high");
        const mediumIssues = result.issues.filter((i) => i.severity === "medium");
        expect(highIssues.length).toBe(1); // missing meta description
        expect(mediumIssues.length).toBe(1); // missing og:image
    });

    it("should categorize broken links as high severity", () => {
        const html = "<html><head><title>Test</title></head><body>Content</body></html>";
        const brokenLinks = [
            { url: "https://example.com/broken", statusCode: 404 },
            { url: "https://example.com/error", statusCode: 500 }
        ];
        const result = getHealthIssues(html, "https://example.com/page", brokenLinks);

        expect(result.url).toBe("https://example.com/page");
        // 1 high (missing description) + 1 medium (missing og:image) + 2 high (broken links) = 4 issues
        expect(result.issues.length).toBe(4);

        const highIssues = result.issues.filter((i) => i.severity === "high");
        expect(highIssues.length).toBe(3); // 1 missing description + 2 broken links
    });
});
