import { describe, expect, it } from "vitest";

import { extractTitle, generateDocsYml } from "./docsYml.js";
import type { FernNavigation } from "./types.js";

describe("generateDocsYml", () => {
    it("should generate simple navigation YAML", () => {
        const navigation: FernNavigation = {
            navigation: [
                {
                    section: "Getting Started",
                    contents: [
                        { page: "Welcome", path: "./pages/welcome.mdx" },
                        { page: "Quick Start", path: "./pages/quick-start.mdx" }
                    ]
                }
            ]
        };

        const yaml = generateDocsYml(navigation, { siteId: "test", includeSchema: false });

        expect(yaml).toContain("navigation:");
        expect(yaml).toContain("section: Getting Started");
        expect(yaml).toContain("page: Welcome");
        expect(yaml).toContain("path: ./pages/welcome.mdx");
    });

    it("should include schema comment when requested", () => {
        const navigation: FernNavigation = {
            navigation: []
        };

        const yaml = generateDocsYml(navigation, { siteId: "test", includeSchema: true });

        expect(yaml).toContain("yaml-language-server: $schema=https://schema.buildwithfern.dev/docs-yml.json");
    });

    it("should not include schema comment when not requested", () => {
        const navigation: FernNavigation = {
            navigation: []
        };

        const yaml = generateDocsYml(navigation, { siteId: "test", includeSchema: false });

        expect(yaml).not.toContain("yaml-language-server");
    });

    it("should include title when provided", () => {
        const navigation: FernNavigation = {
            navigation: []
        };

        const yaml = generateDocsYml(navigation, { siteId: "test", title: "My Docs", includeSchema: false });

        expect(yaml).toContain("title: My Docs");
    });

    it("should include favicon when provided", () => {
        const navigation: FernNavigation = {
            navigation: []
        };

        const yaml = generateDocsYml(navigation, {
            siteId: "test",
            favicon: "./assets/favicon.ico",
            includeSchema: false
        });

        expect(yaml).toContain("favicon: ./assets/favicon.ico");
    });

    it("should generate tabs structure", () => {
        const navigation: FernNavigation = {
            tabs: {
                guides: { displayName: "Guides" },
                api: { displayName: "API Reference" }
            },
            navigation: [
                {
                    tab: "guides",
                    layout: [{ section: "Intro", contents: [{ page: "Welcome", path: "./pages/welcome.mdx" }] }]
                },
                {
                    tab: "api",
                    layout: [{ api: "API Reference" }]
                }
            ]
        };

        const yaml = generateDocsYml(navigation, { siteId: "test", includeSchema: false });

        expect(yaml).toContain("tabs:");
        expect(yaml).toContain("guides:");
        expect(yaml).toContain("display-name: Guides");
        expect(yaml).toContain("tab: guides");
        expect(yaml).toContain("layout:");
    });

    it("should generate products structure with path reference", () => {
        const navigation: FernNavigation = {
            products: [
                {
                    displayName: "Platform",
                    slug: "platform",
                    path: "./products/platform.yml"
                }
            ]
        };

        const yaml = generateDocsYml(navigation, { siteId: "test", includeSchema: false });

        expect(yaml).toContain("products:");
        expect(yaml).toContain("display-name: Platform");
        expect(yaml).toContain("slug: platform");
        expect(yaml).toContain("path: ./products/platform.yml");
    });

    it("should generate API reference item", () => {
        const navigation: FernNavigation = {
            navigation: [{ api: "API Reference" }]
        };

        const yaml = generateDocsYml(navigation, { siteId: "test", includeSchema: false });

        expect(yaml).toContain("api: API Reference");
    });

    it("should generate external link item", () => {
        const navigation: FernNavigation = {
            navigation: [{ link: "GitHub", href: "https://github.com" }]
        };

        const yaml = generateDocsYml(navigation, { siteId: "test", includeSchema: false });

        expect(yaml).toContain("link: GitHub");
        expect(yaml).toContain("href: https://github.com");
    });

    it("should include instances block with siteId-based URL", () => {
        const navigation: FernNavigation = {
            navigation: []
        };

        const yaml = generateDocsYml(navigation, { siteId: "acme", includeSchema: false });

        expect(yaml).toContain("instances:");
        expect(yaml).toContain("url: acme.docs.buildwithfern.com");
    });
});

describe("extractTitle", () => {
    it("should extract title from first product", () => {
        const navigation: FernNavigation = {
            products: [{ displayName: "Platform", slug: "platform" }]
        };

        const title = extractTitle(navigation);

        expect(title).toBe("Platform");
    });

    it("should extract title from first page", () => {
        const navigation: FernNavigation = {
            navigation: [{ page: "Welcome", path: "./welcome.mdx" }]
        };

        const title = extractTitle(navigation);

        expect(title).toBe("Welcome");
    });

    it("should extract title from first section", () => {
        const navigation: FernNavigation = {
            navigation: [{ section: "Getting Started", contents: [] }]
        };

        const title = extractTitle(navigation);

        expect(title).toBe("Getting Started");
    });

    it("should return undefined for empty navigation", () => {
        const navigation: FernNavigation = {
            navigation: []
        };

        const title = extractTitle(navigation);

        expect(title).toBeUndefined();
    });
});
