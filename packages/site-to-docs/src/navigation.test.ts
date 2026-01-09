import { describe, expect, it } from "vitest";

import { buildFernNavigation, collectApiReferencePages } from "./navigation.js";
import type { CrawlResult, PageClassification, PageNode, SiteStructure } from "./types.js";

function createMockPage(url: string, slug: string, title: string, classification: PageClassification): PageNode {
    return {
        url,
        slug,
        title,
        html: "<html></html>",
        markdown: "# Mock content", // Required for pages to be included in navigation
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

    it("should order sections by URL order from contextOrderings, not alphabetically", () => {
        // Create pages in sections that would be alphabetically ordered as:
        // "Capabilities" < "Getting Started" < "Tutorials"
        const pages = [
            createMockPage("https://example.com/overview", "overview", "Overview", {
                section: "Getting Started",
                isApiReference: false
            }),
            createMockPage("https://example.com/quickstart", "quickstart", "Quickstart", {
                section: "Getting Started",
                isApiReference: false
            }),
            createMockPage("https://example.com/plants", "plants", "Plant Management", {
                section: "Capabilities",
                isApiReference: false
            }),
            createMockPage("https://example.com/orders", "orders", "Order Processing", {
                section: "Capabilities",
                isApiReference: false
            }),
            createMockPage("https://example.com/tutorial-1", "tutorial-1", "First Tutorial", {
                section: "Tutorials",
                isApiReference: false
            }),
            createMockPage("https://example.com/tutorial-2", "tutorial-2", "Second Tutorial", {
                section: "Tutorials",
                isApiReference: false
            })
        ];
        const crawlResult = createCrawlResult(pages);

        // Provide contextOrderings that puts "Getting Started" first, then "Capabilities", then "Tutorials"
        // (This is different from alphabetical: Capabilities < Getting Started < Tutorials)
        const siteStructure: SiteStructure = {
            products: [],
            versions: [],
            tabs: [],
            contextOrderings: [
                {
                    contextKey: "",
                    orderedUrls: [
                        "/overview", // Getting Started
                        "/quickstart", // Getting Started
                        "/plants", // Capabilities
                        "/orders", // Capabilities
                        "/tutorial-1", // Tutorials
                        "/tutorial-2" // Tutorials
                    ]
                }
            ]
        };

        const navigation = buildFernNavigation(crawlResult, siteStructure);

        // Should have 3 sections
        expect(navigation.navigation?.length).toBe(3);

        // Extract section names in order
        const sectionNames = navigation.navigation?.map((n) => n.section).filter(Boolean);

        // Should be ordered by URL appearance, NOT alphabetically
        // URL order: Getting Started (overview, quickstart) → Capabilities (plants, orders) → Tutorials
        expect(sectionNames).toEqual(["Getting Started", "Capabilities", "Tutorials"]);

        // Alphabetical would have been: ["Capabilities", "Getting Started", "Tutorials"]
    });

    it("should fall back to alphabetical order when no contextOrderings provided", () => {
        const pages = [
            createMockPage("https://example.com/overview", "overview", "Overview", {
                section: "Getting Started",
                isApiReference: false
            }),
            createMockPage("https://example.com/quickstart", "quickstart", "Quickstart", {
                section: "Getting Started",
                isApiReference: false
            }),
            createMockPage("https://example.com/plants", "plants", "Plant Management", {
                section: "Capabilities",
                isApiReference: false
            }),
            createMockPage("https://example.com/orders", "orders", "Order Processing", {
                section: "Capabilities",
                isApiReference: false
            })
        ];
        const crawlResult = createCrawlResult(pages);

        // No siteStructure provided
        const navigation = buildFernNavigation(crawlResult);

        // Should have 2 sections
        expect(navigation.navigation?.length).toBe(2);

        // Extract section names in order
        const sectionNames = navigation.navigation?.map((n) => n.section).filter(Boolean);

        // Should be alphabetical: Capabilities < Getting Started
        expect(sectionNames).toEqual(["Capabilities", "Getting Started"]);
    });

    it("should merge per-tab orderings when no global ordering exists", () => {
        // This tests the fallback behavior where LLM creates per-tab orderings
        // instead of a global ordering with empty contextKey
        const pages = [
            createMockPage("https://example.com/overview", "overview", "Overview", {
                section: "Getting Started",
                isApiReference: false
            }),
            createMockPage("https://example.com/quickstart", "quickstart", "Quickstart", {
                section: "Getting Started",
                isApiReference: false
            }),
            createMockPage("https://example.com/plants", "plants", "Plant Management", {
                section: "Capabilities",
                isApiReference: false
            }),
            createMockPage("https://example.com/orders", "orders", "Order Processing", {
                section: "Capabilities",
                isApiReference: false
            })
        ];
        const crawlResult = createCrawlResult(pages);

        // Provide per-tab orderings with non-empty context keys (simulating LLM behavior)
        // Note: LLM might create keys like "::Guides" instead of "" for simple sites
        const siteStructure: SiteStructure = {
            products: [],
            versions: [],
            tabs: [],
            contextOrderings: [
                {
                    contextKey: "::Guides", // Per-tab key, won't match "" lookup
                    orderedUrls: [
                        "/overview", // Getting Started
                        "/quickstart", // Getting Started
                        "/plants", // Capabilities
                        "/orders" // Capabilities
                    ]
                }
            ]
        };

        const navigation = buildFernNavigation(crawlResult, siteStructure);

        // Should have 2 sections
        expect(navigation.navigation?.length).toBe(2);

        // Extract section names in order
        const sectionNames = navigation.navigation?.map((n) => n.section).filter(Boolean);

        // Should use merged orderings: Getting Started (overview=0) → Capabilities (plants=2)
        expect(sectionNames).toEqual(["Getting Started", "Capabilities"]);
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
