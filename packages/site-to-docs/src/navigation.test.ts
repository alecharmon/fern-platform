import { describe, expect, it } from "vitest";

import { buildFernNavigation, collectApiReferencePages } from "./navigation.js";
import type { CrawlResult, PageClassification, PageNode } from "./types.js";

function createMockPage(url: string, slug: string, title: string, classification: PageClassification): PageNode {
    return {
        url,
        slug,
        title,
        html: "<html></html>",
        fernFilename: `pages/${slug || "index"}.mdx`,
        fernSlug: slug,
        classification,
        children: []
    };
}

function createCrawlResult(pages: PageNode[], rootUrl: string = "https://example.com"): CrawlResult {
    const pagesMap = new Map<string, PageNode>();
    for (const page of pages) {
        pagesMap.set(page.url, page);
    }
    return {
        pages: pagesMap,
        edges: new Map(),
        backlinks: new Map(),
        warnings: [],
        rootUrl
    };
}

describe("buildFernNavigation", () => {
    it("should create simple navigation for pages with same section", () => {
        const pages = [
            createMockPage("https://example.com/intro", "intro", "Introduction", {
                section: "Getting Started",
                isApiReference: false
            }),
            createMockPage("https://example.com/quickstart", "quickstart", "Quick Start", {
                section: "Getting Started",
                isApiReference: false
            })
        ];
        const crawlResult = createCrawlResult(pages);

        const navigation = buildFernNavigation(crawlResult);

        expect(navigation.navigation).toBeDefined();
        expect(navigation.navigation?.length).toBe(1);
        expect(navigation.navigation?.[0]?.section).toBe("Getting Started");
        expect(navigation.navigation?.[0]?.contents?.length).toBe(2);
    });

    it("should create sections only when multiple pages exist in a section", () => {
        const pages = [
            createMockPage("https://example.com/intro", "intro", "Introduction", {
                section: "Getting Started",
                isApiReference: false
            }),
            createMockPage("https://example.com/setup", "setup", "Setup", {
                section: "Getting Started",
                isApiReference: false
            }),
            createMockPage("https://example.com/auth", "auth", "Authentication", {
                section: "Security",
                isApiReference: false
            })
        ];
        const crawlResult = createCrawlResult(pages);

        const navigation = buildFernNavigation(crawlResult);

        expect(navigation.navigation).toBeDefined();
        // 1 section (Getting Started with 2 pages) + 1 direct page (Security has 1 page)
        expect(navigation.navigation?.length).toBe(2);

        const sections = navigation.navigation?.map((n) => n.section).filter(Boolean);
        expect(sections).toContain("Getting Started");
        // Security section has only 1 page, so it's unwrapped to a direct page
        expect(sections).not.toContain("Security");
    });

    it("should add API reference when pages have isApiReference", () => {
        const pages = [
            createMockPage("https://example.com/intro", "intro", "Introduction", {
                section: "Getting Started",
                isApiReference: false
            }),
            createMockPage("https://example.com/api/users", "api/users", "Users API", {
                section: "API",
                isApiReference: true
            })
        ];
        const crawlResult = createCrawlResult(pages);

        const navigation = buildFernNavigation(crawlResult);

        // Should have sections plus API reference
        const hasApiRef = navigation.navigation?.some((n) => n.api !== undefined);
        expect(hasApiRef).toBe(true);
    });

    it("should NOT include API reference pages in regular navigation sections", () => {
        const pages = [
            createMockPage("https://example.com/intro", "intro", "Introduction", {
                section: "Getting Started",
                isApiReference: false
            }),
            createMockPage("https://example.com/api/users", "api/users", "Users API", {
                section: "API",
                isApiReference: true
            }),
            createMockPage("https://example.com/api/posts", "api/posts", "Posts API", {
                section: "API",
                isApiReference: true
            })
        ];
        const crawlResult = createCrawlResult(pages);

        const navigation = buildFernNavigation(crawlResult);

        // Single-page sections are unwrapped, so "Getting Started" with 1 page becomes a direct page
        // Should have no sections (single pages are unwrapped, API pages become api: ref)
        const sections = navigation.navigation?.filter((n) => n.section !== undefined);
        expect(sections?.length).toBe(0);

        // Should have api: reference entry (not pages)
        const hasApiRef = navigation.navigation?.some((n) => n.api !== undefined);
        expect(hasApiRef).toBe(true);

        // API pages should NOT appear as page entries
        const allPagePaths: string[] = [];
        const collectPagePaths = (items: typeof navigation.navigation) => {
            for (const item of items ?? []) {
                if (item.path) {
                    allPagePaths.push(item.path);
                }
                if (item.contents) {
                    collectPagePaths(item.contents);
                }
            }
        };
        collectPagePaths(navigation.navigation);

        expect(allPagePaths).not.toContain("./pages/api/users.mdx");
        expect(allPagePaths).not.toContain("./pages/api/posts.mdx");
    });

    it("should handle empty crawl result", () => {
        const crawlResult = createCrawlResult([]);

        const navigation = buildFernNavigation(crawlResult);

        expect(navigation.navigation).toBeDefined();
        expect(navigation.navigation?.length).toBe(0);
    });

    it("should handle pages without classification", () => {
        const page: PageNode = {
            url: "https://example.com/intro",
            slug: "intro",
            title: "Introduction",
            html: "<html></html>",
            fernFilename: "pages/intro.mdx",
            fernSlug: "intro",
            children: []
            // No classification
        };
        const crawlResult = createCrawlResult([page]);

        const navigation = buildFernNavigation(crawlResult);

        expect(navigation.navigation).toBeDefined();
        // Page without classification should be skipped
        expect(navigation.navigation?.length).toBe(0);
    });

    it("should create tabs when pages have different tabs", () => {
        const pages = [
            createMockPage("https://example.com/intro", "intro", "Introduction", {
                tab: "Guides",
                section: "Getting Started",
                isApiReference: false
            }),
            createMockPage("https://example.com/sdk", "sdk", "SDK Reference", {
                tab: "SDKs",
                section: "Overview",
                isApiReference: false
            })
        ];
        const crawlResult = createCrawlResult(pages);

        const navigation = buildFernNavigation(crawlResult);

        // Should have tabs defined
        expect(navigation.tabs).toBeDefined();
        expect(Object.keys(navigation.tabs || {}).length).toBe(2);
    });

    it("should create products when pages have different products", () => {
        const pages = [
            createMockPage("https://example.com/platform/intro", "platform/intro", "Platform Intro", {
                product: "Platform",
                section: "Getting Started",
                isApiReference: false
            }),
            createMockPage("https://example.com/sdk/intro", "sdk/intro", "SDK Intro", {
                product: "SDK",
                section: "Getting Started",
                isApiReference: false
            })
        ];
        const crawlResult = createCrawlResult(pages);

        const navigation = buildFernNavigation(crawlResult);

        // Should have products defined
        expect(navigation.products).toBeDefined();
        expect(navigation.products?.length).toBe(2);

        const productNames = navigation.products?.map((p) => p.displayName);
        expect(productNames).toContain("Platform");
        expect(productNames).toContain("SDK");
    });
});

describe("collectApiReferencePages", () => {
    it("should collect only API reference pages", () => {
        const pages = new Map<string, PageNode>();
        pages.set(
            "https://example.com/intro",
            createMockPage("https://example.com/intro", "intro", "Introduction", {
                section: "Getting Started",
                isApiReference: false
            })
        );
        pages.set(
            "https://example.com/api/users",
            createMockPage("https://example.com/api/users", "api/users", "Users API", {
                section: "API",
                isApiReference: true
            })
        );
        pages.set(
            "https://example.com/api/posts",
            createMockPage("https://example.com/api/posts", "api/posts", "Posts API", {
                section: "API",
                isApiReference: true
            })
        );

        const apiPages = collectApiReferencePages(pages);

        expect(apiPages.length).toBe(2);
        expect(apiPages.map((p) => p.title)).toContain("Users API");
        expect(apiPages.map((p) => p.title)).toContain("Posts API");
    });

    it("should return empty array when no API reference pages", () => {
        const pages = new Map<string, PageNode>();
        pages.set(
            "https://example.com/intro",
            createMockPage("https://example.com/intro", "intro", "Introduction", {
                section: "Getting Started",
                isApiReference: false
            })
        );

        const apiPages = collectApiReferencePages(pages);

        expect(apiPages.length).toBe(0);
    });

    it("should sort API pages by slug", () => {
        const pages = new Map<string, PageNode>();
        pages.set(
            "https://example.com/api/users",
            createMockPage("https://example.com/api/users", "api/users", "Users API", {
                section: "API",
                isApiReference: true
            })
        );
        pages.set(
            "https://example.com/api/auth",
            createMockPage("https://example.com/api/auth", "api/auth", "Auth API", {
                section: "API",
                isApiReference: true
            })
        );

        const apiPages = collectApiReferencePages(pages);

        expect(apiPages[0]?.slug).toBe("api/auth");
        expect(apiPages[1]?.slug).toBe("api/users");
    });
});
