import { describe, expect, it } from "vitest";
import { extractCanonicalUrl, extractLinks, extractSlug, extractTitle, normalizeUrl } from "./crawler.js";

describe("normalizeUrl", () => {
    it("removes fragments", () => {
        expect(normalizeUrl("https://example.com/page#section")).toBe("https://example.com/page");
    });

    it("removes trailing slashes except for root", () => {
        expect(normalizeUrl("https://example.com/page/")).toBe("https://example.com/page");
        expect(normalizeUrl("https://example.com/")).toBe("https://example.com/");
    });

    it("lowercases hostname", () => {
        expect(normalizeUrl("https://EXAMPLE.COM/Page")).toBe("https://example.com/Page");
    });

    it("preserves path case", () => {
        expect(normalizeUrl("https://example.com/Getting-Started")).toBe("https://example.com/Getting-Started");
    });

    it("removes query parameters", () => {
        expect(normalizeUrl("https://example.com/page?foo=bar")).toBe("https://example.com/page");
        expect(normalizeUrl("https://example.com/page?explorer=true")).toBe("https://example.com/page");
    });
});

describe("extractTitle", () => {
    it("extracts title from title tag", () => {
        const html = "<html><head><title>My Page Title</title></head><body></body></html>";
        expect(extractTitle(html, "https://example.com/page")).toBe("My Page Title");
    });

    it("extracts title from title tag with attributes", () => {
        const html = '<html><head><title lang="en">My Page Title</title></head></html>';
        expect(extractTitle(html, "https://example.com/page")).toBe("My Page Title");
    });

    it("falls back to h1 if no title tag", () => {
        const html = "<html><body><h1>Welcome to Docs</h1></body></html>";
        expect(extractTitle(html, "https://example.com/page")).toBe("Welcome to Docs");
    });

    it("falls back to h1 with attributes", () => {
        const html = '<html><body><h1 class="header">Welcome</h1></body></html>';
        expect(extractTitle(html, "https://example.com/page")).toBe("Welcome");
    });

    it("falls back to URL path segment", () => {
        const html = "<html><body><p>No title here</p></body></html>";
        expect(extractTitle(html, "https://example.com/getting-started")).toBe("Getting Started");
    });

    it("falls back to hostname for root path", () => {
        const html = "<html><body></body></html>";
        expect(extractTitle(html, "https://docs.example.com/")).toBe("docs.example.com");
    });

    it("trims whitespace from title", () => {
        const html = "<html><head><title>  Spaced Title  </title></head></html>";
        expect(extractTitle(html, "https://example.com/page")).toBe("Spaced Title");
    });
});

describe("extractSlug", () => {
    it("extracts slug from path", () => {
        expect(extractSlug("https://example.com/getting-started")).toBe("getting-started");
    });

    it("extracts nested slug", () => {
        expect(extractSlug("https://example.com/guides/quickstart")).toBe("guides/quickstart");
    });

    it("returns empty string for root", () => {
        expect(extractSlug("https://example.com/")).toBe("");
    });

    it("removes leading and trailing slashes", () => {
        expect(extractSlug("https://example.com/docs/intro/")).toBe("docs/intro");
    });
});

describe("extractLinks", () => {
    const baseUrl = new URL("https://example.com/docs/page");

    it("extracts absolute same-origin links", () => {
        const html = '<a href="https://example.com/other">Link</a>';
        expect(extractLinks(html, baseUrl)).toEqual(["https://example.com/other"]);
    });

    it("extracts relative links", () => {
        const html = '<a href="/getting-started">Link</a>';
        expect(extractLinks(html, baseUrl)).toEqual(["https://example.com/getting-started"]);
    });

    it("extracts relative links without leading slash", () => {
        const html = '<a href="sibling">Link</a>';
        expect(extractLinks(html, baseUrl)).toEqual(["https://example.com/docs/sibling"]);
    });

    it("skips external links", () => {
        const html = '<a href="https://other.com/page">External</a>';
        expect(extractLinks(html, baseUrl)).toEqual([]);
    });

    it("skips anchor links", () => {
        const html = '<a href="#section">Anchor</a>';
        expect(extractLinks(html, baseUrl)).toEqual([]);
    });

    it("skips javascript: links", () => {
        const html = '<a href="javascript:void(0)">JS</a>';
        expect(extractLinks(html, baseUrl)).toEqual([]);
    });

    it("skips mailto: links", () => {
        const html = '<a href="mailto:test@example.com">Email</a>';
        expect(extractLinks(html, baseUrl)).toEqual([]);
    });

    it("skips tel: links", () => {
        const html = '<a href="tel:+1234567890">Phone</a>';
        expect(extractLinks(html, baseUrl)).toEqual([]);
    });

    it("skips asset files", () => {
        const html = `
            <a href="/image.png">PNG</a>
            <a href="/style.css">CSS</a>
            <a href="/script.js">JS</a>
            <a href="/doc.pdf">PDF</a>
        `;
        expect(extractLinks(html, baseUrl)).toEqual([]);
    });

    it("deduplicates links", () => {
        const html = `
            <a href="/page">Link 1</a>
            <a href="/page">Link 2</a>
            <a href="/page#section">Link 3</a>
        `;
        expect(extractLinks(html, baseUrl)).toEqual(["https://example.com/page"]);
    });

    it("normalizes links (removes trailing slash)", () => {
        const html = '<a href="/page/">Link</a>';
        expect(extractLinks(html, baseUrl)).toEqual(["https://example.com/page"]);
    });

    it("handles single and double quotes", () => {
        const html = `
            <a href="/single">Single</a>
            <a href='/double'>Double</a>
        `;
        expect(extractLinks(html, baseUrl)).toContain("https://example.com/single");
        expect(extractLinks(html, baseUrl)).toContain("https://example.com/double");
    });

    it("handles multiple links in document", () => {
        const html = `
            <nav>
                <a href="/home">Home</a>
                <a href="/docs">Docs</a>
                <a href="/api">API</a>
            </nav>
        `;
        const links = extractLinks(html, baseUrl);
        expect(links).toHaveLength(3);
        expect(links).toContain("https://example.com/home");
        expect(links).toContain("https://example.com/docs");
        expect(links).toContain("https://example.com/api");
    });

    // JSON slug extraction tests
    it("extracts links from JSON slug fields", () => {
        const html = `
            <script>
                {"slug":"platform/guides/overview"}
            </script>
        `;
        expect(extractLinks(html, baseUrl)).toContain("https://example.com/platform/guides/overview");
    });

    it("extracts links from JSON slug fields with spaces around colon", () => {
        const html = `{"slug" : "docs/getting-started"}`;
        expect(extractLinks(html, baseUrl)).toContain("https://example.com/docs/getting-started");
    });

    it("extracts multiple slugs from JSON data", () => {
        const html = `
            [
                {"slug":"page-one","title":"Page One"},
                {"slug":"page-two","title":"Page Two"},
                {"slug":"nested/page-three","title":"Page Three"}
            ]
        `;
        const links = extractLinks(html, baseUrl);
        expect(links).toContain("https://example.com/page-one");
        expect(links).toContain("https://example.com/page-two");
        expect(links).toContain("https://example.com/nested/page-three");
    });

    it("combines href and JSON slug extraction", () => {
        const html = `
            <a href="/from-href">Link</a>
            <script>{"slug":"from-json"}</script>
        `;
        const links = extractLinks(html, baseUrl);
        expect(links).toContain("https://example.com/from-href");
        expect(links).toContain("https://example.com/from-json");
    });

    it("deduplicates between href and JSON slugs", () => {
        const html = `
            <a href="/same-page">Link</a>
            <script>{"slug":"same-page"}</script>
        `;
        const links = extractLinks(html, baseUrl);
        expect(links).toHaveLength(1);
        expect(links).toContain("https://example.com/same-page");
    });

    it("skips slugs that look like URLs", () => {
        const html = `{"slug":"https://other.com/page"}`;
        expect(extractLinks(html, baseUrl)).toEqual([]);
    });

    it("handles slugs with leading slash", () => {
        const html = `{"slug":"/already-has-slash"}`;
        expect(extractLinks(html, baseUrl)).toContain("https://example.com/already-has-slash");
    });

    it("extracts slugs from escaped JSON (Next.js RSC payload)", () => {
        const html = String.raw`\",\"slug\":\"platform/guides/overview\"`;
        expect(extractLinks(html, baseUrl)).toContain("https://example.com/platform/guides/overview");
    });

    it("extracts multiple escaped slugs", () => {
        const html = String.raw`{\"slug\":\"page-one\",\"title\":\"One\"},{\"slug\":\"page-two\"}`;
        const links = extractLinks(html, baseUrl);
        expect(links).toContain("https://example.com/page-one");
        expect(links).toContain("https://example.com/page-two");
    });
});

describe("extractCanonicalUrl", () => {
    it("extracts canonical URL from link tag", () => {
        const html = '<html><head><link rel="canonical" href="https://example.com/canonical-page"></head></html>';
        const baseUrl = new URL("https://example.com/old-page");
        expect(extractCanonicalUrl(html, baseUrl)).toBe("https://example.com/canonical-page");
    });

    it("extracts canonical with href before rel", () => {
        const html = '<html><head><link href="https://example.com/canonical-page" rel="canonical"></head></html>';
        const baseUrl = new URL("https://example.com/old-page");
        expect(extractCanonicalUrl(html, baseUrl)).toBe("https://example.com/canonical-page");
    });

    it("resolves relative canonical URLs", () => {
        const html = '<html><head><link rel="canonical" href="/docs/intro"></head></html>';
        const baseUrl = new URL("https://example.com/old-page");
        expect(extractCanonicalUrl(html, baseUrl)).toBe("https://example.com/docs/intro");
    });

    it("normalizes canonical URL (removes trailing slash)", () => {
        const html = '<html><head><link rel="canonical" href="/docs/intro/"></head></html>';
        const baseUrl = new URL("https://example.com/old-page");
        expect(extractCanonicalUrl(html, baseUrl)).toBe("https://example.com/docs/intro");
    });

    it("returns null for cross-origin canonical", () => {
        const html = '<html><head><link rel="canonical" href="https://other.com/page"></head></html>';
        const baseUrl = new URL("https://example.com/page");
        expect(extractCanonicalUrl(html, baseUrl)).toBeNull();
    });

    it("returns null when no canonical tag present", () => {
        const html = "<html><head><title>Page</title></head></html>";
        const baseUrl = new URL("https://example.com/page");
        expect(extractCanonicalUrl(html, baseUrl)).toBeNull();
    });

    it("handles single quotes", () => {
        const html = "<html><head><link rel='canonical' href='https://example.com/canonical'></head></html>";
        const baseUrl = new URL("https://example.com/old-page");
        expect(extractCanonicalUrl(html, baseUrl)).toBe("https://example.com/canonical");
    });

    it("handles extra attributes on link tag", () => {
        const html =
            '<html><head><link rel="canonical" href="https://example.com/canonical" data-turbolinks-track="reload"></head></html>';
        const baseUrl = new URL("https://example.com/old-page");
        expect(extractCanonicalUrl(html, baseUrl)).toBe("https://example.com/canonical");
    });

    it("handles canonical URL with query params (normalized away)", () => {
        const html = '<html><head><link rel="canonical" href="https://example.com/page?ref=123"></head></html>';
        const baseUrl = new URL("https://example.com/old-page");
        expect(extractCanonicalUrl(html, baseUrl)).toBe("https://example.com/page");
    });

    it("returns null for invalid URL in canonical", () => {
        const html = '<html><head><link rel="canonical" href="not-a-valid-url-://foo"></head></html>';
        const baseUrl = new URL("https://example.com/page");
        expect(extractCanonicalUrl(html, baseUrl)).toBeNull();
    });
});

describe("extractLinks with real fixture", () => {
    it("discovers all expected pages from acmeco platform/concepts fixture", async () => {
        const fs = await import("node:fs/promises");
        const path = await import("node:path");

        const fixturePath = path.join(import.meta.dirname, "fixtures/fern-docs-acmeco-platform-concepts.html");
        const html = await fs.readFile(fixturePath, "utf-8");
        const baseUrl = new URL("https://acmeco.docs.buildwithfern.com/platform/concepts");

        const links = extractLinks(html, baseUrl);

        // The fixture contains navigation data with escaped JSON slugs from Next.js RSC payload
        // This includes pages from href attributes AND slugs from serialized JSON
        const expectedSlugs = [
            // API and search endpoints
            "api/fern-docs/search/v2/key",

            // Root-level pages
            "concepts",
            "wiki",

            // Platform pages (unversioned)
            "platform",
            "platform/welcome",
            "platform/concepts",
            "platform/encodings",
            "platform/home",
            "platform/sdks",

            // Platform API reference
            "platform/api-reference",
            "platform/api-reference/introduction",
            "platform/api-reference/api-reference",
            "platform/api-reference/api-reference/plant",
            "platform/api-reference/api-reference/plant/add-plant",
            "platform/api-reference/api-reference/plant/get-plant-by-id",
            "platform/api-reference/api-reference/plant/search-plants-by-status",
            "platform/api-reference/api-reference/plant/search-plants-by-tags",
            "platform/api-reference/api-reference/plant/update-plant",
            "platform/api-reference/api-reference/user",
            "platform/api-reference/api-reference/user/get-user-by-name",
            "platform/api-reference/api-reference/user/login-user",
            "platform/api-reference/api-reference/user/logout-user",

            // Platform guides
            "platform/guides",
            "platform/guides/empty",
            "platform/guides/empty-collapsed",
            "platform/guides/overview",
            "platform/guides/overview/untitled",
            "platform/guides/overview/inline-content",
            "platform/guides/more-topics",
            "platform/guides/more-topics/delivery-information",
            "platform/guides/more-topics/plant-care-guide",
            "platform/guides/more-topics/plant-care-guide/watering-basics",
            "platform/guides/more-topics/plant-care-guide/light-requirements",

            // Platform versions
            "platform/v-1",
            "platform/v-1/platform",
            "platform/v-2",
            "platform/v-2/welcome",
            "platform/v-2/concepts",
            "platform/v-2/encodings",
            "platform/v-2/home",
            "platform/v-2/sdks",

            // Platform v-2 API reference
            "platform/v-2/api-reference",
            "platform/v-2/api-reference/introduction",
            "platform/v-2/api-reference/api-reference",
            "platform/v-2/api-reference/api-reference/plant",
            "platform/v-2/api-reference/api-reference/plant/add-plant",
            "platform/v-2/api-reference/api-reference/plant/get-plant-by-id",
            "platform/v-2/api-reference/api-reference/plant/search-plants-by-status",
            "platform/v-2/api-reference/api-reference/plant/search-plants-by-tags",
            "platform/v-2/api-reference/api-reference/plant/update-plant",
            "platform/v-2/api-reference/api-reference/user",
            "platform/v-2/api-reference/api-reference/user/get-user-by-name",
            "platform/v-2/api-reference/api-reference/user/login-user",
            "platform/v-2/api-reference/api-reference/user/logout-user",

            // Platform v-2 guides
            "platform/v-2/guides",
            "platform/v-2/guides/empty",
            "platform/v-2/guides/empty-collapsed",
            "platform/v-2/guides/overview",
            "platform/v-2/guides/overview/untitled",
            "platform/v-2/guides/overview/inline-content",
            "platform/v-2/guides/more-topics",
            "platform/v-2/guides/more-topics/delivery-information",
            "platform/v-2/guides/more-topics/plant-care-guide",
            "platform/v-2/guides/more-topics/plant-care-guide/watering-basics",
            "platform/v-2/guides/more-topics/plant-care-guide/light-requirements"
        ];

        // Convert slugs to full URLs and compare as sets
        const expectedUrls = expectedSlugs.map((slug) => `https://acmeco.docs.buildwithfern.com/${slug}`);
        expect(links.sort()).toEqual(expectedUrls.sort());
    });
});
