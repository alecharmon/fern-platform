import { describe, expect, it } from "vitest";
import {
    buildClassificationPrompt,
    buildSectionClassificationPrompt,
    buildSiteStructurePrompt,
    deriveFromStructure,
    enforceConsistency,
    extractNavigationStructure,
    extractPageContext,
    extractTextPreview,
    extractUrlPathSegments,
    extractUrlPrefix,
    groupPagesByPrefix
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
    it("extracts essential context from a page", () => {
        const page: PageNode = {
            url: "https://example.com/docs/guides/auth",
            slug: "docs/guides/auth",
            title: "Authentication Guide",
            html: `
                <html>
                <body>
                    <h1>How to Set Up Authentication</h1>
                    <p>This guide explains authentication.</p>
                </body>
                </html>
            `,
            children: []
        };

        const context = extractPageContext(page);

        expect(context.url).toBe("https://example.com/docs/guides/auth");
        expect(context.urlPathSegments).toEqual(["docs", "guides", "auth"]);
        expect(context.pageTitle).toBe("Authentication Guide");
        expect(context.contentSnippet).toContain("authentication");
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
                contentSnippet: "Welcome to the docs"
            },
            {
                url: "https://example.com/docs/setup",
                urlPathSegments: ["docs", "setup"],
                pageTitle: "Setup",
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
                contentSnippet: "How to authenticate"
            }
        ];

        const prompt = buildClassificationPrompt(contexts);

        expect(prompt).toContain("https://example.com/docs/auth");
        expect(prompt).toContain("Authentication");
    });

    it("includes content preview", () => {
        const contexts = [
            {
                url: "https://example.com/docs/auth",
                urlPathSegments: ["docs", "auth"],
                pageTitle: "Auth",
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
                contentSnippet: "Content"
            }
        ];

        const prompt = buildClassificationPrompt(contexts);

        expect(prompt).toContain("section");
        expect(prompt).toContain("isApiReference");
    });
});

// ============================================================================
// extractNavigationStructure tests
// ============================================================================

describe("extractNavigationStructure", () => {
    it("extracts sections from structural patterns (text before ul)", () => {
        const html = `
            <div>
                <strong>API Reference</strong>
                <ul>
                    <li><a href="/api/users">Users</a></li>
                    <li><a href="/api/posts">Posts</a></li>
                </ul>
            </div>
        `;

        const result = extractNavigationStructure(html, "https://example.com");

        expect(result.urlToSection.size).toBe(2);
        expect(result.urlToSection.get("/api/users")).toBe("API Reference");
        expect(result.urlToSection.get("/api/posts")).toBe("API Reference");
    });

    it("resolves relative URLs correctly", () => {
        const html = `
            <div>Getting Started</div>
            <ul>
                <li><a href="intro">Introduction</a></li>
                <li><a href="../other">Other</a></li>
            </ul>
        `;

        const result = extractNavigationStructure(html, "https://example.com/docs/page");

        expect(result.urlToSection.get("/docs/intro")).toBe("Getting Started");
        expect(result.urlToSection.get("/other")).toBe("Getting Started");
    });

    it("ignores hash and javascript links", () => {
        const html = `
            <strong>Section</strong>
            <ul>
                <li><a href="#section">Anchor</a></li>
                <li><a href="javascript:void(0)">Script</a></li>
                <li><a href="/real-page">Real Page</a></li>
            </ul>
        `;

        const result = extractNavigationStructure(html, "https://example.com");

        expect(result.urlToSection.size).toBe(1);
        expect(result.urlToSection.get("/real-page")).toBe("Section");
    });

    it("returns empty map when no sections found", () => {
        const html = `<html><body><p>No navigation here</p></body></html>`;

        const result = extractNavigationStructure(html, "https://example.com");

        expect(result.urlToSection.size).toBe(0);
        expect(result.hints.sections).toHaveLength(0);
    });

    it("does not duplicate URLs across sections", () => {
        const html = `
            <strong>First</strong>
            <ul>
                <li><a href="/page">Page</a></li>
            </ul>
            <strong>Second</strong>
            <ul>
                <li><a href="/page">Same Page</a></li>
            </ul>
        `;

        const result = extractNavigationStructure(html, "https://example.com");

        // Should only have one entry - first one wins
        expect(result.urlToSection.size).toBe(1);
        expect(result.urlToSection.get("/page")).toBe("First");
    });

    it("extracts sections from div containers with multiple links (card groups)", () => {
        const html = `
            <h2>Get Started</h2>
            <div class="card-group">
                <a href="/quickstart">Quickstart</a>
                <a href="/overview">Overview</a>
            </div>
        `;

        const result = extractNavigationStructure(html, "https://example.com");

        expect(result.urlToSection.size).toBe(2);
        expect(result.urlToSection.get("/quickstart")).toBe("Get Started");
        expect(result.urlToSection.get("/overview")).toBe("Get Started");
    });

    it("requires at least 2 links for div containers to avoid false positives", () => {
        const html = `
            <h2>Single Link Section</h2>
            <div>
                <a href="/only-one">Only One Link</a>
            </div>
        `;

        const result = extractNavigationStructure(html, "https://example.com");

        // Should not match - only 1 link in div
        expect(result.urlToSection.size).toBe(0);
    });

    // Tests for ordering preservation
    it("preserves section order in hints", () => {
        const html = `
            <strong>First Section</strong>
            <ul>
                <li><a href="/a">Page A</a></li>
            </ul>
            <strong>Second Section</strong>
            <ul>
                <li><a href="/b">Page B</a></li>
            </ul>
            <strong>Third Section</strong>
            <ul>
                <li><a href="/c">Page C</a></li>
            </ul>
        `;

        const result = extractNavigationStructure(html, "https://example.com");

        expect(result.hints.sections).toEqual(["First Section", "Second Section", "Third Section"]);
    });

    it("preserves URL order within sections", () => {
        const html = `
            <strong>API Reference</strong>
            <ul>
                <li><a href="/api/users">Users</a></li>
                <li><a href="/api/posts">Posts</a></li>
                <li><a href="/api/comments">Comments</a></li>
            </ul>
        `;

        const result = extractNavigationStructure(html, "https://example.com");

        const urls = result.hints.pagesBySection.get("API Reference");
        expect(urls).toEqual(["/api/users", "/api/posts", "/api/comments"]);
    });

    it("tracks URLs per section correctly with multiple sections", () => {
        const html = `
            <strong>Getting Started</strong>
            <ul>
                <li><a href="/intro">Introduction</a></li>
                <li><a href="/quickstart">Quickstart</a></li>
            </ul>
            <strong>Advanced</strong>
            <ul>
                <li><a href="/config">Configuration</a></li>
                <li><a href="/plugins">Plugins</a></li>
            </ul>
        `;

        const result = extractNavigationStructure(html, "https://example.com");

        expect(result.hints.sections).toEqual(["Getting Started", "Advanced"]);
        expect(result.hints.pagesBySection.get("Getting Started")).toEqual(["/intro", "/quickstart"]);
        expect(result.hints.pagesBySection.get("Advanced")).toEqual(["/config", "/plugins"]);
    });
});

// ============================================================================
// buildSiteStructurePrompt tests
// ============================================================================

describe("buildSiteStructurePrompt", () => {
    it("includes all URLs in prompt", () => {
        const urls = ["/guides/intro", "/guides/setup", "/api/users"];

        const prompt = buildSiteStructurePrompt(urls);

        expect(prompt).toContain("/guides/intro");
        expect(prompt).toContain("/guides/setup");
        expect(prompt).toContain("/api/users");
    });

    it("includes page count", () => {
        const urls = Array.from({ length: 50 }, (_, i) => `/page-${i}`);

        const prompt = buildSiteStructurePrompt(urls);

        expect(prompt).toContain("50 pages");
    });

    it("truncates URLs beyond 100", () => {
        const urls = Array.from({ length: 150 }, (_, i) => `/page-${i}`);

        const prompt = buildSiteStructurePrompt(urls);

        expect(prompt).toContain("150 pages");
        expect(prompt).toContain("and 50 more pages");
    });

    it("includes entry point URL when provided", () => {
        const urls = ["/docs/intro", "/docs/setup"];

        const prompt = buildSiteStructurePrompt(urls, "/docs/intro");

        expect(prompt).toContain("ENTRY POINT URL: /docs/intro");
    });

    it("shows top-level URL segments", () => {
        const urls = ["/docs/intro", "/api/users", "/guides/setup"];

        const prompt = buildSiteStructurePrompt(urls);

        expect(prompt).toContain("TOP-LEVEL URL SEGMENTS:");
        expect(prompt).toContain("docs");
        expect(prompt).toContain("api");
        expect(prompt).toContain("guides");
    });

    it("includes navigation hints when provided", () => {
        const urls = ["/intro", "/quickstart", "/api/users"];
        const hints = {
            sections: ["Getting Started", "API Reference"],
            pagesBySection: new Map([
                ["Getting Started", ["/intro", "/quickstart"]],
                ["API Reference", ["/api/users"]]
            ])
        };

        const prompt = buildSiteStructurePrompt(urls, undefined, hints);

        expect(prompt).toContain("NAVIGATION ORDER HINTS");
        expect(prompt).toContain("Sections in order: Getting Started, API Reference");
        expect(prompt).toContain('Pages in "Getting Started": /intro, /quickstart');
        expect(prompt).toContain('Pages in "API Reference": /api/users');
    });

    it("omits navigation hints section when hints are empty", () => {
        const urls = ["/intro", "/quickstart"];
        const emptyHints = {
            sections: [],
            pagesBySection: new Map()
        };

        const prompt = buildSiteStructurePrompt(urls, undefined, emptyHints);

        // Should not contain the "from HTML structure" hints section (but may mention hints in instructions)
        expect(prompt).not.toContain("from HTML structure");
        expect(prompt).not.toContain("Sections in order:");
    });

    it("truncates navigation hints for many sections", () => {
        const urls = ["/page"];
        const sections = Array.from({ length: 15 }, (_, i) => `Section ${i}`);
        const hints = {
            sections: sections,
            pagesBySection: new Map(sections.map((s) => [s, [`/${s.toLowerCase().replace(" ", "-")}`]]))
        };

        const prompt = buildSiteStructurePrompt(urls, undefined, hints);

        expect(prompt).toContain("NAVIGATION ORDER HINTS");
        expect(prompt).toContain("and 5 more sections");
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
                contentSnippet: "Welcome",
                derivedProduct: "Platform",
                derivedVersion: undefined
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
                contentSnippet: "Auth content",
                derivedProduct: "Platform",
                derivedVersion: "v2"
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
