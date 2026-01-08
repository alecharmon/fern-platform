import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { generateDocsScore, getHealthScore } from "../services/generateDocsScore";

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

        expect(result.score).toBe(85);
        expect(result.data.categories).toEqual([]);
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

        expect(result.score).toBe(0);
        expect(result.data.categories).toHaveLength(1);
        expect(result.data.categories[0].categoryName).toBe("Sitemap");
        expect(result.data.categories[0].issues[0].issueType).toBe("Empty Sitemap");
    });

    it("should handle sitemap fetch error", async () => {
        mockFetch.mockResolvedValue({
            ok: false,
            status: 404,
            statusText: "Not Found"
        });

        const result = await generateDocsScore("example.com");

        expect(result.score).toBe(0);
        expect(result.data.categories).toHaveLength(1);
        expect(result.data.categories[0].categoryName).toBe("Error");
        expect(result.data.categories[0].issues[0].issueType).toBe("Scraping Error");
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
            return Promise.resolve({
                ok: true,
                text: () => Promise.resolve("<html></html>")
            });
        });

        const result = await generateDocsScore("example.com");

        expect(result.score).toBe(43);
        expect(result.data.categories).toHaveLength(1);
        expect(result.data.categories[0].categoryName).toBe("Fetch Error");
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
            return Promise.resolve({
                ok: true,
                text: () => Promise.resolve("<html></html>")
            });
        });

        const result = await generateDocsScore("example.com", 5);

        expect(result.score).toBe(85);
        expect(mockFetch).toHaveBeenCalledTimes(26);
    });
});

describe("getHealthScore", () => {
    it("should return placeholder score of 85", () => {
        const html = "<html><head><title>Test</title></head><body>Content</body></html>";
        const result = getHealthScore(html, "https://example.com/page");

        expect(result.url).toBe("https://example.com/page");
        expect(result.score).toBe(85);
        expect(result.issues).toEqual([]);
    });
});
