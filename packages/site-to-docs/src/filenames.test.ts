import { describe, expect, it } from "vitest";

import { assignFilenamesAndSlugs, buildUrlToSlugMap, generateFernFilename, generateFernSlug } from "./filenames.js";
import type { PageNode } from "./types.js";

function createMockPage(slug: string, title = "Test Page"): PageNode {
    return {
        url: `https://example.com/${slug}`,
        slug,
        title,
        html: "<html></html>",
        children: []
    };
}

describe("generateFernFilename", () => {
    it("should generate filename for root page", () => {
        const page = createMockPage("");
        expect(generateFernFilename(page)).toBe("pages/index.mdx");
    });

    it("should generate filename for simple slug", () => {
        const page = createMockPage("getting-started");
        expect(generateFernFilename(page)).toBe("pages/getting-started.mdx");
    });

    it("should generate filename for nested slug", () => {
        const page = createMockPage("guides/overview");
        expect(generateFernFilename(page)).toBe("pages/guides/overview.mdx");
    });

    it("should generate filename for deeply nested slug", () => {
        const page = createMockPage("platform/guides/advanced/topics");
        expect(generateFernFilename(page)).toBe("pages/platform/guides/advanced/topics.mdx");
    });

    it("should handle leading slashes", () => {
        const page = createMockPage("/getting-started");
        expect(generateFernFilename(page)).toBe("pages/getting-started.mdx");
    });

    it("should handle trailing slashes", () => {
        const page = createMockPage("getting-started/");
        expect(generateFernFilename(page)).toBe("pages/getting-started.mdx");
    });
});

describe("generateFernSlug", () => {
    it("should return empty string for root page", () => {
        const page = createMockPage("");
        expect(generateFernSlug(page)).toBe("");
    });

    it("should return slug for simple page", () => {
        const page = createMockPage("getting-started");
        expect(generateFernSlug(page)).toBe("getting-started");
    });

    it("should return slug for nested page", () => {
        const page = createMockPage("guides/overview");
        expect(generateFernSlug(page)).toBe("guides/overview");
    });

    it("should strip leading slashes", () => {
        const page = createMockPage("/getting-started");
        expect(generateFernSlug(page)).toBe("getting-started");
    });
});

describe("assignFilenamesAndSlugs", () => {
    it("should assign unique filenames to all pages", () => {
        const pages = new Map<string, PageNode>();
        pages.set("https://example.com/", createMockPage(""));
        pages.set("https://example.com/intro", createMockPage("intro"));
        pages.set("https://example.com/guides/overview", createMockPage("guides/overview"));

        assignFilenamesAndSlugs(pages);

        const pageList = Array.from(pages.values());
        expect(pageList[0]?.fernFilename).toBe("pages/index.mdx");
        expect(pageList[1]?.fernFilename).toBe("pages/intro.mdx");
        expect(pageList[2]?.fernFilename).toBe("pages/guides/overview.mdx");
    });

    it("should handle duplicate filenames", () => {
        const pages = new Map<string, PageNode>();
        pages.set("https://example.com/intro", createMockPage("intro"));
        pages.set("https://other.com/intro", createMockPage("intro")); // Same slug, different URL

        assignFilenamesAndSlugs(pages);

        const pageList = Array.from(pages.values());
        expect(pageList[0]?.fernFilename).toBe("pages/intro.mdx");
        expect(pageList[1]?.fernFilename).toBe("pages/intro-2.mdx");
    });

    it("should assign fernSlug to all pages", () => {
        const pages = new Map<string, PageNode>();
        pages.set("https://example.com/", createMockPage(""));
        pages.set("https://example.com/guides/overview", createMockPage("guides/overview"));

        assignFilenamesAndSlugs(pages);

        const pageList = Array.from(pages.values());
        expect(pageList[0]?.fernSlug).toBe("");
        expect(pageList[1]?.fernSlug).toBe("guides/overview");
    });
});

describe("buildUrlToSlugMap", () => {
    it("should build map from URL to fernSlug", () => {
        const pages = new Map<string, PageNode>();
        const page1 = createMockPage("intro");
        page1.fernSlug = "intro";
        const page2 = createMockPage("guides/overview");
        page2.fernSlug = "guides/overview";

        pages.set("https://example.com/intro", page1);
        pages.set("https://example.com/guides/overview", page2);

        const map = buildUrlToSlugMap(pages);

        expect(map.get("https://example.com/intro")).toBe("intro");
        expect(map.get("https://example.com/guides/overview")).toBe("guides/overview");
    });

    it("should skip pages without fernSlug", () => {
        const pages = new Map<string, PageNode>();
        const page1 = createMockPage("intro");
        page1.fernSlug = "intro";
        const page2 = createMockPage("guides/overview"); // No fernSlug

        pages.set("https://example.com/intro", page1);
        pages.set("https://example.com/guides/overview", page2);

        const map = buildUrlToSlugMap(pages);

        expect(map.size).toBe(1);
        expect(map.has("https://example.com/intro")).toBe(true);
        expect(map.has("https://example.com/guides/overview")).toBe(false);
    });
});
