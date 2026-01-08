import { describe, expect, it } from "vitest";
import {
    aggregateNavigationSignals,
    buildClassificationPrompt,
    buildSectionClassificationPrompt,
    buildSiteStructurePrompt,
    deriveFromStructure,
    detectVersion,
    enforceConsistency,
    extractBreadcrumbPath,
    extractPageContext,
    extractSiteNavigationLinks,
    extractTextPreview,
    extractUrlPathSegments,
    extractUrlPrefix,
    groupPagesByPrefix,
    inferPageType
} from "./classifier.js";
import type { PageNode, SiteStructure } from "./types.js";

// ============================================================================
// extractTextPreview tests (unchanged from before)
// ============================================================================

describe("extractTextPreview", () => {
    it("removes script tags and content", () => {
        const html = '<html><body><script>alert("hi");</script><p>Hello World</p></body></html>';
        expect(extractTextPreview(html)).toContain("Hello World");
        expect(extractTextPreview(html)).not.toContain("alert");
    });

    it("removes style tags and content", () => {
        const html = "<html><head><style>body { color: red; }</style></head><body><p>Content</p></body></html>";
        expect(extractTextPreview(html)).toContain("Content");
        expect(extractTextPreview(html)).not.toContain("color");
    });

    it("removes HTML tags", () => {
        const html = "<div><h1>Title</h1><p>Paragraph with <strong>bold</strong> text.</p></div>";
        const result = extractTextPreview(html);
        expect(result).toContain("Title");
        expect(result).toContain("Paragraph");
        expect(result).toContain("bold");
        expect(result).not.toContain("<h1>");
        expect(result).not.toContain("<strong>");
    });

    it("decodes common HTML entities", () => {
        const html = "<p>A &amp; B &lt; C &gt; D &quot;E&quot; &#39;F&#39;</p>";
        const result = extractTextPreview(html);
        expect(result).toContain("A & B < C > D");
        expect(result).toContain('"E"');
        expect(result).toContain("'F'");
    });

    it("collapses whitespace", () => {
        const html = "<p>Hello    \n\n   World</p>";
        expect(extractTextPreview(html)).toBe("Hello World");
    });

    it("truncates to max length", () => {
        const longContent = "A".repeat(3000);
        const html = `<p>${longContent}</p>`;
        const result = extractTextPreview(html, 100);
        expect(result.length).toBeLessThanOrEqual(103); // 100 + "..."
        expect(result.endsWith("...")).toBe(true);
    });

    it("does not truncate short content", () => {
        const html = "<p>Short content</p>";
        const result = extractTextPreview(html, 100);
        expect(result).toBe("Short content");
        expect(result.endsWith("...")).toBe(false);
    });

    it("handles nested script tags", () => {
        const html = `
            <body>
                <script type="application/json">{"key": "value"}</script>
                <p>Main content</p>
                <script>console.log("test");</script>
            </body>
        `;
        const result = extractTextPreview(html);
        expect(result).toContain("Main content");
        expect(result).not.toContain("key");
        expect(result).not.toContain("console");
    });
});

// ============================================================================
// extractBreadcrumbPath tests
// ============================================================================

describe("extractBreadcrumbPath", () => {
    it("extracts breadcrumbs from aria-label nav", () => {
        const html = `
            <nav aria-label="Breadcrumb">
                <ol>
                    <li><a href="/">Home</a></li>
                    <li><a href="/docs">Docs</a></li>
                    <li><a href="/docs/guides">Guides</a></li>
                    <li>Current Page</li>
                </ol>
            </nav>
        `;
        const result = extractBreadcrumbPath(html);
        expect(result).toEqual(["Home", "Docs", "Guides", "Current Page"]);
    });

    it("extracts breadcrumbs from .breadcrumb class", () => {
        const html = `
            <div class="breadcrumb">
                <a href="/">Home</a> > 
                <a href="/docs">Documentation</a> >
                <span>Getting Started</span>
            </div>
        `;
        const result = extractBreadcrumbPath(html);
        expect(result).toContain("Home");
        expect(result).toContain("Documentation");
        expect(result).toContain("Getting Started");
    });

    it("extracts breadcrumbs from Schema.org BreadcrumbList", () => {
        const html = `
            <ol itemtype="https://schema.org/BreadcrumbList">
                <li itemprop="itemListElement">
                    <a itemprop="item"><span itemprop="name">Home</span></a>
                </li>
                <li itemprop="itemListElement">
                    <a itemprop="item"><span itemprop="name">Products</span></a>
                </li>
            </ol>
        `;
        const result = extractBreadcrumbPath(html);
        expect(result).toContain("Home");
        expect(result).toContain("Products");
    });

    it("filters out separator characters", () => {
        const html = `
            <nav aria-label="breadcrumb">
                <ol>
                    <li><a>Home</a></li>
                    <li>></li>
                    <li><a>Docs</a></li>
                    <li>/</li>
                    <li>Page</li>
                </ol>
            </nav>
        `;
        const result = extractBreadcrumbPath(html);
        expect(result).not.toContain(">");
        expect(result).not.toContain("/");
        expect(result).toContain("Home");
        expect(result).toContain("Docs");
    });

    it("returns empty array when no breadcrumbs found", () => {
        const html = "<html><body><h1>Just a page</h1></body></html>";
        const result = extractBreadcrumbPath(html);
        expect(result).toEqual([]);
    });
});

// ============================================================================
// extractSiteNavigationLinks tests
// ============================================================================

describe("extractSiteNavigationLinks", () => {
    it("extracts links from header nav", () => {
        const html = `
            <header>
                <nav>
                    <a href="/guides">Guides</a>
                    <a href="/api">API Reference</a>
                    <a href="/sdks">SDKs</a>
                </nav>
            </header>
        `;
        const result = extractSiteNavigationLinks(html);
        expect(result).toContain("Guides");
        expect(result).toContain("API Reference");
        expect(result).toContain("SDKs");
    });

    it("extracts links from role=navigation", () => {
        const html = `
            <div role="navigation">
                <a href="/docs">Documentation</a>
                <a href="/blog">Blog</a>
            </div>
        `;
        const result = extractSiteNavigationLinks(html);
        expect(result).toContain("Documentation");
        expect(result).toContain("Blog");
    });

    it("filters out utility links", () => {
        const html = `
            <header>
                <nav>
                    <a href="/guides">Guides</a>
                    <a href="/login">Login</a>
                    <a href="/signup">Sign Up</a>
                    <a href="/search">Search</a>
                </nav>
            </header>
        `;
        const result = extractSiteNavigationLinks(html);
        expect(result).toContain("Guides");
        expect(result).not.toContain("Login");
        expect(result).not.toContain("Sign Up");
        expect(result).not.toContain("Search");
    });

    it("deduplicates links", () => {
        const html = `
            <header>
                <nav>
                    <a href="/guides">Guides</a>
                    <a href="/guides">guides</a>
                </nav>
            </header>
        `;
        const result = extractSiteNavigationLinks(html);
        expect(result).toHaveLength(1);
    });

    it("returns empty array when no nav found", () => {
        const html = "<html><body><p>No navigation here</p></body></html>";
        const result = extractSiteNavigationLinks(html);
        expect(result).toEqual([]);
    });
});

// ============================================================================
// detectVersion tests
// ============================================================================

describe("detectVersion", () => {
    it("detects version from select dropdown", () => {
        const html = `
            <select class="version-selector">
                <option value="v1">v1</option>
                <option value="v2" selected>v2</option>
            </select>
        `;
        const result = detectVersion(html);
        expect(result).toBe("v2");
    });

    it("detects version from data-version attribute", () => {
        const html = '<div data-version="v1.5">Content</div>';
        const result = detectVersion(html);
        expect(result).toBe("v1.5");
    });

    it("detects version from version badge", () => {
        const html = '<span class="version-badge">v3.0.1</span>';
        const result = detectVersion(html);
        expect(result).toBe("v3.0.1");
    });

    it("detects latest as version", () => {
        const html = '<span class="version-tag">Latest</span>';
        const result = detectVersion(html);
        expect(result).toBe("latest");
    });

    it("detects bare version numbers", () => {
        const html = '<span class="version-badge">2.0</span>';
        const result = detectVersion(html);
        expect(result).toBe("2.0");
    });

    it("returns undefined when no version found", () => {
        const html = "<html><body>No version info</body></html>";
        const result = detectVersion(html);
        expect(result).toBeUndefined();
    });
});

// ============================================================================
// inferPageType tests
// ============================================================================

describe("inferPageType", () => {
    it("identifies reference pages with HTTP methods", () => {
        const html = `
            <html><body>
                <h1>Get User</h1>
                <pre>GET /users/{id}</pre>
                <table>
                    <tr><th>Parameter</th><th>Type</th></tr>
                    <tr><td>id</td><td>string</td></tr>
                </table>
            </body></html>
        `;
        const result = inferPageType(html);
        expect(result).toBe("reference");
    });

    it("identifies reference pages with endpoint paths", () => {
        const html = `
            <html><body>
                <code>"/users/{user_id}"</code>
                <pre>Response: { "id": "123" }</pre>
                <pre>Request body</pre>
                <pre>Headers</pre>
            </body></html>
        `;
        const result = inferPageType(html);
        expect(result).toBe("reference");
    });

    it("identifies guide pages with how-to content", () => {
        const html = `
            <html><body>
                <h1>How to Set Up Authentication</h1>
                <p>In this tutorial, we'll walk through setting up auth.</p>
                <ol>
                    <li>Step 1: Install the SDK</li>
                    <li>Step 2: Configure credentials</li>
                </ol>
            </body></html>
        `;
        const result = inferPageType(html);
        expect(result).toBe("guide");
    });

    it("identifies overview pages", () => {
        const html = `
            <html><body>
                <h1>Welcome to Our Docs</h1>
                <p>Introduction to our platform.</p>
                <a href="/guide1">Guide 1</a>
                <a href="/guide2">Guide 2</a>
                <a href="/guide3">Guide 3</a>
                <a href="/guide4">Guide 4</a>
                <a href="/guide5">Guide 5</a>
                <a href="/guide6">Guide 6</a>
            </body></html>
        `;
        const result = inferPageType(html);
        expect(result).toBe("overview");
    });

    it("returns unknown for ambiguous content", () => {
        const html = `
            <html><body>
                <h1>Some Page</h1>
                <p>This is just regular content without clear signals.</p>
                <p>More content here.</p>
            </body></html>
        `;
        const result = inferPageType(html);
        expect(result).toBe("unknown");
    });
});

// ============================================================================
// extractUrlPathSegments tests
// ============================================================================

describe("extractUrlPathSegments", () => {
    it("extracts path segments from URL", () => {
        const result = extractUrlPathSegments("https://example.com/platform/guides/intro");
        expect(result).toEqual(["platform", "guides", "intro"]);
    });

    it("returns empty array for root path", () => {
        const result = extractUrlPathSegments("https://example.com/");
        expect(result).toEqual([]);
    });

    it("handles single segment", () => {
        const result = extractUrlPathSegments("https://example.com/about");
        expect(result).toEqual(["about"]);
    });

    it("handles invalid URLs gracefully", () => {
        const result = extractUrlPathSegments("not-a-url");
        expect(result).toEqual([]);
    });
});

// ============================================================================
// extractUrlPrefix tests
// ============================================================================

describe("extractUrlPrefix", () => {
    it("extracts parent path from URL", () => {
        expect(extractUrlPrefix("https://example.com/docs/guides/intro")).toBe("docs/guides");
    });

    it("returns empty string for single-segment path", () => {
        expect(extractUrlPrefix("https://example.com/api")).toBe("");
    });

    it("returns empty string for root path", () => {
        expect(extractUrlPrefix("https://example.com/")).toBe("");
    });

    it("handles deep nesting", () => {
        expect(extractUrlPrefix("https://example.com/a/b/c/d/page")).toBe("a/b/c/d");
    });

    it("handles versioned paths", () => {
        expect(extractUrlPrefix("https://example.com/platform/v-2/guides/intro")).toBe("platform/v-2/guides");
    });
});

// ============================================================================
// extractPageContext tests
// ============================================================================

describe("extractPageContext", () => {
    it("extracts full context from a page", () => {
        const page: PageNode = {
            url: "https://example.com/docs/guides/auth",
            slug: "docs/guides/auth",
            title: "Authentication Guide",
            html: `
                <html>
                <body>
                    <nav aria-label="breadcrumb">
                        <ol>
                            <li><a>Home</a></li>
                            <li><a>Docs</a></li>
                            <li><a>Guides</a></li>
                        </ol>
                    </nav>
                    <header>
                        <nav>
                            <a href="/guides">Guides</a>
                            <a href="/api">API</a>
                        </nav>
                    </header>
                    <span class="version-badge">v2</span>
                    <h1>How to Set Up Authentication</h1>
                    <ol><li>Step 1</li><li>Step 2</li></ol>
                </body>
                </html>
            `,
            children: []
        };

        const context = extractPageContext(page);

        expect(context.url).toBe("https://example.com/docs/guides/auth");
        expect(context.urlPathSegments).toEqual(["docs", "guides", "auth"]);
        expect(context.pageTitle).toBe("Authentication Guide");
        expect(context.breadcrumbPath).toContain("Docs");
        expect(context.breadcrumbPath).toContain("Guides");
        expect(context.siteNavigationLinks).toContain("Guides");
        expect(context.siteNavigationLinks).toContain("API");
        expect(context.detectedVersion).toBe("v2");
        expect(context.inferredPageType).toBe("guide");
    });
});

// ============================================================================
// groupPagesByPrefix tests
// ============================================================================

describe("groupPagesByPrefix", () => {
    function createMockPage(url: string, title: string): PageNode {
        return {
            url,
            slug: url.replace("https://example.com/", ""),
            title,
            html: `<html><body><h1>${title}</h1><p>Content for ${title}</p></body></html>`,
            children: []
        };
    }

    it("groups pages by URL prefix", () => {
        const pages = new Map<string, PageNode>([
            ["https://example.com/guides/intro", createMockPage("https://example.com/guides/intro", "Intro")],
            ["https://example.com/guides/setup", createMockPage("https://example.com/guides/setup", "Setup")],
            ["https://example.com/api/users", createMockPage("https://example.com/api/users", "Users API")]
        ]);

        const { groups } = groupPagesByPrefix(pages);

        expect(groups).toHaveLength(2);

        // Groups are now PageContext[][] not PageGroup[]
        const guidesGroup = groups.find((g) => g.some((ctx) => ctx.url.includes("/guides/")));
        const apiGroup = groups.find((g) => g.some((ctx) => ctx.url.includes("/api/")));

        expect(guidesGroup).toHaveLength(2);
        expect(apiGroup).toHaveLength(1);
    });

    it("includes content snippets in grouped pages", () => {
        const pages = new Map<string, PageNode>([
            ["https://example.com/docs/page", createMockPage("https://example.com/docs/page", "My Page")]
        ]);

        const { groups } = groupPagesByPrefix(pages);

        expect(groups[0]?.[0]?.contentSnippet).toContain("My Page");
    });

    it("splits large groups and emits warning", () => {
        const pages = new Map<string, PageNode>();
        for (let i = 0; i < 25; i++) {
            const url = `https://example.com/docs/page-${i}`;
            pages.set(url, createMockPage(url, `Page ${i}`));
        }

        const { groups, warnings } = groupPagesByPrefix(pages, { maxGroupSize: 10 });

        // Should split 25 pages into 3 groups (10 + 10 + 5)
        const docsGroups = groups.filter((g) => g.some((ctx) => ctx.url.includes("/docs/")));
        expect(docsGroups).toHaveLength(3);

        // Should emit a warning about the split
        expect(warnings).toHaveLength(1);
        expect(warnings[0]).toContain("maxGroupSize limit (10) exceeded");
        expect(warnings[0]).toContain("docs");
        expect(warnings[0]).toContain("25 pages");
    });

    it("handles root-level pages", () => {
        const pages = new Map<string, PageNode>([
            ["https://example.com/about", createMockPage("https://example.com/about", "About")],
            ["https://example.com/contact", createMockPage("https://example.com/contact", "Contact")]
        ]);

        const { groups } = groupPagesByPrefix(pages);

        expect(groups).toHaveLength(1);
        expect(groups[0]).toHaveLength(2);
    });

    it("does not emit warning when groups are within limit", () => {
        const pages = new Map<string, PageNode>([
            ["https://example.com/docs/page-1", createMockPage("https://example.com/docs/page-1", "Page 1")],
            ["https://example.com/docs/page-2", createMockPage("https://example.com/docs/page-2", "Page 2")]
        ]);

        const { warnings } = groupPagesByPrefix(pages, { maxGroupSize: 10 });

        expect(warnings).toHaveLength(0);
    });
});

// ============================================================================
// enforceConsistency tests
// ============================================================================

describe("enforceConsistency", () => {
    function createPageWithClassification(url: string, section: string, tab: string = "Guides"): PageNode {
        return {
            url,
            slug: url.replace("https://example.com/", ""),
            title: "Page",
            html: "<html></html>",
            children: [],
            classification: {
                tab,
                section,
                isApiReference: false
            }
        };
    }

    it("normalizes section name case variations", () => {
        const pages = new Map<string, PageNode>([
            ["https://example.com/a", createPageWithClassification("https://example.com/a", "Getting Started")],
            ["https://example.com/b", createPageWithClassification("https://example.com/b", "Getting Started")],
            ["https://example.com/c", createPageWithClassification("https://example.com/c", "getting started")]
        ]);

        enforceConsistency(pages);

        // Most common variant should win (Getting Started appears twice)
        expect(pages.get("https://example.com/c")?.classification?.section).toBe("Getting Started");
    });

    it("normalizes hyphenated section names", () => {
        const pages = new Map<string, PageNode>([
            ["https://example.com/a", createPageWithClassification("https://example.com/a", "API Reference")],
            ["https://example.com/b", createPageWithClassification("https://example.com/b", "API Reference")],
            ["https://example.com/c", createPageWithClassification("https://example.com/c", "api-reference")]
        ]);

        enforceConsistency(pages);

        expect(pages.get("https://example.com/c")?.classification?.section).toBe("API Reference");
    });

    it("normalizes tab name variations", () => {
        const pages = new Map<string, PageNode>([
            ["https://example.com/a", createPageWithClassification("https://example.com/a", "Intro", "Guides")],
            ["https://example.com/b", createPageWithClassification("https://example.com/b", "Setup", "Guides")],
            ["https://example.com/c", createPageWithClassification("https://example.com/c", "Advanced", "guides")]
        ]);

        enforceConsistency(pages);

        expect(pages.get("https://example.com/c")?.classification?.tab).toBe("Guides");
    });

    it("preserves distinct section names", () => {
        const pages = new Map<string, PageNode>([
            ["https://example.com/a", createPageWithClassification("https://example.com/a", "Getting Started")],
            ["https://example.com/b", createPageWithClassification("https://example.com/b", "Authentication")]
        ]);

        enforceConsistency(pages);

        expect(pages.get("https://example.com/a")?.classification?.section).toBe("Getting Started");
        expect(pages.get("https://example.com/b")?.classification?.section).toBe("Authentication");
    });

    it("handles pages without classification", () => {
        const pages = new Map<string, PageNode>([
            ["https://example.com/a", createPageWithClassification("https://example.com/a", "Section")],
            [
                "https://example.com/b",
                {
                    url: "https://example.com/b",
                    slug: "b",
                    title: "Page",
                    html: "<html></html>",
                    children: []
                    // No classification
                }
            ]
        ]);

        // Should not throw
        expect(() => enforceConsistency(pages)).not.toThrow();
    });
});

// ============================================================================
// buildClassificationPrompt tests
// ============================================================================

describe("buildClassificationPrompt", () => {
    it("includes page count", () => {
        const contexts = [
            {
                url: "https://example.com/docs/intro",
                urlPathSegments: ["docs", "intro"],
                pageTitle: "Introduction",
                breadcrumbPath: ["Docs", "Intro"],
                siteNavigationLinks: ["Guides", "API"],
                detectedVersion: undefined,
                inferredPageType: "guide" as const,
                contentSnippet: "Welcome to the docs"
            },
            {
                url: "https://example.com/docs/setup",
                urlPathSegments: ["docs", "setup"],
                pageTitle: "Setup",
                breadcrumbPath: ["Docs", "Setup"],
                siteNavigationLinks: ["Guides", "API"],
                detectedVersion: undefined,
                inferredPageType: "guide" as const,
                contentSnippet: "How to set up"
            }
        ];

        const prompt = buildClassificationPrompt(contexts);

        expect(prompt).toContain("2 documentation pages");
    });

    it("includes page URLs and titles", () => {
        const contexts = [
            {
                url: "https://example.com/docs/auth",
                urlPathSegments: ["docs", "auth"],
                pageTitle: "Authentication",
                breadcrumbPath: [],
                siteNavigationLinks: [],
                detectedVersion: undefined,
                inferredPageType: "guide" as const,
                contentSnippet: "How to authenticate"
            }
        ];

        const prompt = buildClassificationPrompt(contexts);

        expect(prompt).toContain("https://example.com/docs/auth");
        expect(prompt).toContain("Authentication");
    });

    it("includes breadcrumbs when present", () => {
        const contexts = [
            {
                url: "https://example.com/docs/auth",
                urlPathSegments: ["docs", "auth"],
                pageTitle: "Auth",
                breadcrumbPath: ["Home", "Docs", "Authentication"],
                siteNavigationLinks: [],
                detectedVersion: undefined,
                inferredPageType: "guide" as const,
                contentSnippet: "Content"
            }
        ];

        const prompt = buildClassificationPrompt(contexts);

        expect(prompt).toContain("Breadcrumbs: Home > Docs > Authentication");
    });

    it("includes page type hint", () => {
        const contexts = [
            {
                url: "https://example.com/docs/auth",
                urlPathSegments: ["docs", "auth"],
                pageTitle: "Auth",
                breadcrumbPath: [],
                siteNavigationLinks: ["Guides", "API Reference", "SDKs"],
                detectedVersion: undefined,
                inferredPageType: "guide" as const,
                contentSnippet: "Content"
            }
        ];

        const prompt = buildClassificationPrompt(contexts);

        expect(prompt).toContain("Page type hint: guide");
    });

    it("includes content preview", () => {
        const contexts = [
            {
                url: "https://example.com/docs/auth",
                urlPathSegments: ["docs", "auth"],
                pageTitle: "Auth",
                breadcrumbPath: [],
                siteNavigationLinks: [],
                detectedVersion: "v2",
                inferredPageType: "guide" as const,
                contentSnippet: "Authentication content here"
            }
        ];

        const prompt = buildClassificationPrompt(contexts);

        expect(prompt).toContain("Authentication content");
    });

    it("includes section and isApiReference in instructions", () => {
        const contexts = [
            {
                url: "https://example.com/docs/page",
                urlPathSegments: ["docs", "page"],
                pageTitle: "Page",
                breadcrumbPath: [],
                siteNavigationLinks: [],
                detectedVersion: undefined,
                inferredPageType: "unknown" as const,
                contentSnippet: "Content"
            }
        ];

        const prompt = buildClassificationPrompt(contexts);

        expect(prompt).toContain("section");
        expect(prompt).toContain("isApiReference");
    });
});

// ============================================================================
// Phase 1: aggregateNavigationSignals tests
// ============================================================================

describe("aggregateNavigationSignals", () => {
    function createPageWithHtml(url: string, html: string): PageNode {
        return {
            url,
            slug: url.replace("https://example.com/", ""),
            title: "Page",
            html,
            children: []
        };
    }

    it("aggregates breadcrumb roots from all pages", () => {
        const pages = new Map<string, PageNode>([
            [
                "https://example.com/guides/intro",
                createPageWithHtml(
                    "https://example.com/guides/intro",
                    `<nav aria-label="breadcrumb"><ol><li><a>Home</a></li><li><a>Guides</a></li></ol></nav>`
                )
            ],
            [
                "https://example.com/api/users",
                createPageWithHtml(
                    "https://example.com/api/users",
                    `<nav aria-label="breadcrumb"><ol><li><a>Home</a></li><li><a>API Reference</a></li></ol></nav>`
                )
            ]
        ]);

        const signals = aggregateNavigationSignals(pages);

        expect(signals.uniqueBreadcrumbRoots).toContain("Guides");
        expect(signals.uniqueBreadcrumbRoots).toContain("API Reference");
    });

    it("aggregates nav links from all pages", () => {
        const pages = new Map<string, PageNode>([
            [
                "https://example.com/page1",
                createPageWithHtml(
                    "https://example.com/page1",
                    `<header><nav><a href="/guides">Guides</a><a href="/api">API</a></nav></header>`
                )
            ],
            [
                "https://example.com/page2",
                createPageWithHtml(
                    "https://example.com/page2",
                    `<header><nav><a href="/guides">Guides</a><a href="/sdks">SDKs</a></nav></header>`
                )
            ]
        ]);

        const signals = aggregateNavigationSignals(pages);

        expect(signals.uniqueNavLinks).toContain("Guides");
        expect(signals.uniqueNavLinks).toContain("API");
        expect(signals.uniqueNavLinks).toContain("SDKs");
    });

    it("aggregates detected versions from all pages", () => {
        const pages = new Map<string, PageNode>([
            [
                "https://example.com/v1/page",
                createPageWithHtml("https://example.com/v1/page", `<span class="version-badge">v1</span>`)
            ],
            [
                "https://example.com/v2/page",
                createPageWithHtml("https://example.com/v2/page", `<span class="version-badge">v2</span>`)
            ]
        ]);

        const signals = aggregateNavigationSignals(pages);

        expect(signals.uniqueVersions).toContain("v1");
        expect(signals.uniqueVersions).toContain("v2");
    });

    it("deduplicates signals", () => {
        const pages = new Map<string, PageNode>([
            [
                "https://example.com/page1",
                createPageWithHtml(
                    "https://example.com/page1",
                    `<header><nav><a href="/guides">Guides</a></nav></header><span class="version-badge">v1</span>`
                )
            ],
            [
                "https://example.com/page2",
                createPageWithHtml(
                    "https://example.com/page2",
                    `<header><nav><a href="/guides">Guides</a></nav></header><span class="version-badge">v1</span>`
                )
            ]
        ]);

        const signals = aggregateNavigationSignals(pages);

        expect(signals.uniqueNavLinks.filter((l) => l === "Guides")).toHaveLength(1);
        expect(signals.uniqueVersions.filter((v) => v === "v1")).toHaveLength(1);
    });

    it("limits sample breadcrumb paths to 20", () => {
        const pages = new Map<string, PageNode>();
        for (let i = 0; i < 30; i++) {
            const url = `https://example.com/page-${i}`;
            pages.set(
                url,
                createPageWithHtml(
                    url,
                    `<nav aria-label="breadcrumb"><ol><li><a>Home</a></li><li><a>Section ${i}</a></li></ol></nav>`
                )
            );
        }

        const signals = aggregateNavigationSignals(pages);

        expect(signals.sampleBreadcrumbPaths.length).toBeLessThanOrEqual(20);
    });
});

// ============================================================================
// buildSiteStructurePrompt tests
// ============================================================================

describe("buildSiteStructurePrompt", () => {
    const baseSignals = {
        uniqueBreadcrumbRoots: [],
        uniqueNavLinks: [],
        uniqueVersions: [],
        sampleBreadcrumbPaths: [],
        sidebarSignals: []
    };

    it("includes all URLs in prompt", () => {
        const urls = ["/guides/intro", "/guides/setup", "/api/users"];

        const prompt = buildSiteStructurePrompt(urls, baseSignals);

        expect(prompt).toContain("/guides/intro");
        expect(prompt).toContain("/guides/setup");
        expect(prompt).toContain("/api/users");
    });

    it("includes page count", () => {
        const urls = Array.from({ length: 50 }, (_, i) => `/page-${i}`);

        const prompt = buildSiteStructurePrompt(urls, baseSignals);

        expect(prompt).toContain("50 pages");
    });

    it("includes aggregated nav signals", () => {
        const urls = ["/page"];
        const signals = {
            ...baseSignals,
            uniqueBreadcrumbRoots: ["Guides", "API Reference"],
            uniqueNavLinks: ["Documentation", "Blog"],
            uniqueVersions: ["v1", "v2"],
            sampleBreadcrumbPaths: [["Home", "Guides", "Intro"]]
        };

        const prompt = buildSiteStructurePrompt(urls, signals);

        expect(prompt).toContain("Guides, API Reference");
        expect(prompt).toContain("Documentation, Blog");
        expect(prompt).toContain("v1, v2");
        expect(prompt).toContain("Home > Guides > Intro");
    });

    it("truncates URLs beyond 100", () => {
        const urls = Array.from({ length: 150 }, (_, i) => `/page-${i}`);

        const prompt = buildSiteStructurePrompt(urls, baseSignals);

        expect(prompt).toContain("150 pages");
        expect(prompt).toContain("and 50 more pages");
    });

    it("includes sidebar signals in prompt", () => {
        const urls = ["/docs/intro", "/docs/setup"];
        const signals = {
            ...baseSignals,
            sidebarSignals: [
                {
                    url: "https://example.com/docs/intro",
                    links: [
                        { text: "Introduction", href: "https://example.com/docs/intro" },
                        { text: "Setup", href: "https://example.com/docs/setup" }
                    ]
                }
            ]
        };

        const prompt = buildSiteStructurePrompt(urls, signals);

        expect(prompt).toContain("SIDEBAR NAVIGATION ORDER");
        expect(prompt).toContain("https://example.com/docs/intro");
        expect(prompt).toContain("Introduction");
    });

    it("includes navigation links grouped by URL prefix", () => {
        const urls = ["/docs/intro", "/api/users"];
        const signals = {
            ...baseSignals,
            sidebarSignals: [
                {
                    url: "https://example.com/docs/intro",
                    links: [
                        { text: "Introduction", href: "https://example.com/docs/intro" },
                        { text: "Users API", href: "https://example.com/api/users" }
                    ]
                }
            ]
        };

        const prompt = buildSiteStructurePrompt(urls, signals);

        expect(prompt).toContain("ALL NAVIGATION LINKS");
        expect(prompt).toContain("/docs/");
        expect(prompt).toContain("/api/");
    });
});

// ============================================================================
// deriveFromStructure tests
// ============================================================================

describe("deriveFromStructure", () => {
    const structure: SiteStructure = {
        products: [
            { name: "Platform", urlPrefix: "platform" },
            { name: "CLI", urlPrefix: "cli" }
        ],
        versions: [
            { name: "v1", urlPattern: "v-1" },
            { name: "v2", urlPattern: "v-2" }
        ],
        tabs: [
            { name: "Guides", urlPattern: "guides" },
            { name: "API Reference", urlPattern: "api" }
        ],
        contextOrderings: []
    };

    it("derives product from URL", () => {
        const result = deriveFromStructure("https://example.com/platform/guides/intro", structure);
        expect(result.derivedProduct).toBe("Platform");
    });

    it("derives version from URL", () => {
        const result = deriveFromStructure("https://example.com/platform/v-2/guides/intro", structure);
        expect(result.derivedVersion).toBe("v2");
    });

    // NOTE: Tab derivation tests removed - tabs are now assigned by Phase 2 LLM
    // based on page content, not URL patterns

    it("returns undefined for unmatched product", () => {
        const result = deriveFromStructure("https://example.com/other/page", structure);
        expect(result.derivedProduct).toBeUndefined();
    });

    it("assigns 'Latest' version when site has versions but URL doesn't match any", () => {
        const result = deriveFromStructure("https://example.com/platform/latest/page", structure);
        expect(result.derivedVersion).toBe("Latest");
    });

    it("returns undefined for version when site has no versions", () => {
        const noVersionStructure: SiteStructure = {
            products: [{ name: "Platform", urlPrefix: "platform" }],
            versions: [],
            tabs: [{ name: "Guides", urlPattern: "guides" }],
            contextOrderings: []
        };
        const result = deriveFromStructure("https://example.com/platform/page", noVersionStructure);
        expect(result.derivedVersion).toBeUndefined();
    });

    // NOTE: "defaults to first tab" test removed - tabs are now assigned by Phase 2 LLM

    it("handles CLI product", () => {
        const result = deriveFromStructure("https://example.com/cli/commands/init", structure);
        expect(result.derivedProduct).toBe("CLI");
    });
});

// ============================================================================
// buildSectionClassificationPrompt tests
// ============================================================================

describe("buildSectionClassificationPrompt", () => {
    const structure: SiteStructure = {
        products: [{ name: "Platform", urlPrefix: "platform" }],
        versions: [{ name: "v2", urlPattern: "v-2" }],
        tabs: [{ name: "Guides" }, { name: "API Reference" }],
        contextOrderings: []
    };

    it("includes site structure summary", () => {
        const contexts = [
            {
                url: "https://example.com/platform/guides/intro",
                urlPathSegments: ["platform", "guides", "intro"],
                pageTitle: "Introduction",
                breadcrumbPath: [],
                siteNavigationLinks: [],
                detectedVersion: undefined,
                inferredPageType: "guide" as const,
                contentSnippet: "Welcome",
                derivedProduct: "Platform",
                derivedVersion: undefined
                // Note: derivedTab removed - tabs assigned by LLM in Phase 2
            }
        ];

        const prompt = buildSectionClassificationPrompt(contexts, structure);

        expect(prompt).toContain("Products: Platform");
        expect(prompt).toContain("Versions: v2");
        // Tabs are now in DISCOVERED TABS section, not as a summary line
        expect(prompt).toContain("DISCOVERED TABS:");
        expect(prompt).toContain('"Guides"');
        expect(prompt).toContain('"API Reference"');
    });

    it("includes derived classifications", () => {
        const contexts = [
            {
                url: "https://example.com/platform/v-2/guides/auth",
                urlPathSegments: ["platform", "v-2", "guides", "auth"],
                pageTitle: "Auth",
                breadcrumbPath: [],
                siteNavigationLinks: [],
                detectedVersion: "v2",
                inferredPageType: "guide" as const,
                contentSnippet: "Auth content",
                derivedProduct: "Platform",
                derivedVersion: "v2"
                // Note: derivedTab is no longer used - tabs are assigned by LLM in Phase 2
            }
        ];

        const prompt = buildSectionClassificationPrompt(contexts, structure);

        // Tab is now assigned by LLM, not derived - only product and version are shown
        expect(prompt).toContain("Derived: product=Platform, version=v2");
    });

    it("asks for tab, section, and isApiReference", () => {
        const contexts = [
            {
                url: "https://example.com/page",
                urlPathSegments: ["page"],
                pageTitle: "Page",
                breadcrumbPath: [],
                siteNavigationLinks: [],
                detectedVersion: undefined,
                inferredPageType: "unknown" as const,
                contentSnippet: "Content"
            }
        ];

        const prompt = buildSectionClassificationPrompt(contexts, structure);

        // Tab is now assigned by LLM along with section and isApiReference
        expect(prompt).toContain("tab");
        expect(prompt).toContain("section");
        expect(prompt).toContain("isApiReference");
        // Should NOT ask LLM to determine product/version - those are still derived from URL
        expect(prompt).not.toMatch(/determine:.*\bproduct\b/i);
        expect(prompt).not.toMatch(/determine:.*\bversion\b/i);
    });
});
