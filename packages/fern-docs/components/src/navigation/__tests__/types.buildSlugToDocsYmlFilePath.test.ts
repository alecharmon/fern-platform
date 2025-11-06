import { describe, expect, it } from "vitest";
import { buildSlugToDocsYmlFilePath } from "../types";

describe("buildSlugToDocsYmlFilePath", () => {
    it("returns empty map when docsYmlContent is null", () => {
        const result = buildSlugToDocsYmlFilePath(null);
        expect(result).toBeInstanceOf(Map);
        expect(result.size).toBe(0);
    });

    it("returns empty map when docs.yml is not in the content", () => {
        const content = new Map([["other.yml", "some content"]]);
        const result = buildSlugToDocsYmlFilePath(content);
        expect(result).toBeInstanceOf(Map);
        expect(result.size).toBe(0);
    });

    it("parses top-level products with slugs", () => {
        const docsYml = `
products:
  - display-name: API Reference
    slug: api
    path: ./api.yml
  - display-name: Guide
    slug: guide
    path: ./guide.yml
`;
        const content = new Map([["docs.yml", docsYml]]);
        const result = buildSlugToDocsYmlFilePath(content);

        expect(result.size).toBe(2);
        expect(result.get("api")).toBe("api.yml");
        expect(result.get("guide")).toBe("guide.yml");
    });

    it("parses top-level versions", () => {
        const docsYml = `
versions:
  - display-name: v2
    slug: v2
    path: ./versions/v2.yml
  - display-name: v1
    slug: v1
    path: ./versions/v1.yml
`;
        const content = new Map([["docs.yml", docsYml]]);
        const result = buildSlugToDocsYmlFilePath(content);

        expect(result.size).toBe(2);
        expect(result.get("v2")).toBe("versions/v2.yml");
        expect(result.get("v1")).toBe("versions/v1.yml");
    });

    it("parses products with nested versions", () => {
        const docsYml = `
products:
  - display-name: Platform
    slug: platform
    path: docs/products/platform/v2.yml
    versions:
      - display-name: v2
        slug: platform-v2
        path: docs/products/platform/v2.yml
        availability: stable
      - display-name: v1
        slug: platform-v1
        path: docs/products/platform/v1.yml
  - display-name: Wiki
    slug: wiki
    path: docs/products/wiki.yml
`;
        const content = new Map([["docs.yml", docsYml]]);
        const result = buildSlugToDocsYmlFilePath(content);

        expect(result.size).toBe(4);
        // Product slugs
        expect(result.get("platform")).toBe("docs/products/platform/v2.yml");
        expect(result.get("wiki")).toBe("docs/products/wiki.yml");
        // Nested version slugs
        expect(result.get("platform-v2")).toBe("docs/products/platform/v2.yml");
        expect(result.get("platform-v1")).toBe("docs/products/platform/v1.yml");
    });

    it("parses products with nested versions without explicit product slug", () => {
        const docsYml = `
products:
  - display-name: Platform
    path: docs/products/platform/v2.yml
    versions:
      - display-name: v2
        slug: v2
        path: docs/products/platform/v2.yml
      - display-name: v1
        slug: v1
        path: docs/products/platform/v1.yml
`;
        const content = new Map([["docs.yml", docsYml]]);
        const result = buildSlugToDocsYmlFilePath(content);

        expect(result.size).toBe(2);
        // Product slug derived from path "v2" collides with explicit version slug "v2"
        // The version slug wins (last one to be processed)
        expect(result.get("v2")).toBe("docs/products/platform/v2.yml");
        // Explicit version slugs
        expect(result.get("v1")).toBe("docs/products/platform/v1.yml");
    });

    it("derives slugs from paths when not explicitly provided", () => {
        const docsYml = `
products:
  - display-name: API
    path: docs/api.yml
  - display-name: Platform
    path: docs/products/platform.yml
versions:
  - display-name: Version 2
    path: ./versions/v2.yml
tabs:
  - display-name: Home
    path: ./home.yml
`;
        const content = new Map([["docs.yml", docsYml]]);
        const result = buildSlugToDocsYmlFilePath(content);

        expect(result.size).toBe(4);
        // All slugs derived from filenames
        expect(result.get("api")).toBe("docs/api.yml");
        expect(result.get("platform")).toBe("docs/products/platform.yml");
        expect(result.get("v2")).toBe("versions/v2.yml");
        expect(result.get("home")).toBe("home.yml");
    });

    it("parses tabs with file references", () => {
        const docsYml = `
tabs:
  - display-name: Home
    slug: home
    path: ./tabs/home.yml
  - display-name: Guides
    slug: guides
    path: ./tabs/guides.yml
`;
        const content = new Map([["docs.yml", docsYml]]);
        const result = buildSlugToDocsYmlFilePath(content);

        expect(result.size).toBe(2);
        expect(result.get("home")).toBe("tabs/home.yml");
        expect(result.get("guides")).toBe("tabs/guides.yml");
    });

    it("normalizes paths by removing ./ prefix", () => {
        const docsYml = `
products:
  - slug: api
    path: ./api.yml
versions:
  - slug: v2
    path: ./versions/v2.yml
tabs:
  - slug: home
    path: ./tabs/home.yml
`;
        const content = new Map([["docs.yml", docsYml]]);
        const result = buildSlugToDocsYmlFilePath(content);

        expect(result.get("api")).toBe("api.yml");
        expect(result.get("v2")).toBe("versions/v2.yml");
        expect(result.get("home")).toBe("tabs/home.yml");
    });

    it("handles mixed configuration with products, versions, and tabs", () => {
        const docsYml = `
products:
  - display-name: Platform
    slug: platform
    path: docs/products/platform/v2.yml
    versions:
      - slug: platform-v2
        path: docs/products/platform/v2.yml
      - slug: platform-v1
        path: docs/products/platform/v1.yml
versions:
  - slug: v3
    path: versions/v3.yml
tabs:
  - slug: home
    path: tabs/home.yml
`;
        const content = new Map([["docs.yml", docsYml]]);
        const result = buildSlugToDocsYmlFilePath(content);

        expect(result.size).toBe(5);
        expect(result.get("platform")).toBe("docs/products/platform/v2.yml");
        expect(result.get("platform-v2")).toBe("docs/products/platform/v2.yml");
        expect(result.get("platform-v1")).toBe("docs/products/platform/v1.yml");
        expect(result.get("v3")).toBe("versions/v3.yml");
        expect(result.get("home")).toBe("tabs/home.yml");
    });

    it("ignores products without slug or path", () => {
        const docsYml = `
products:
  - display-name: Platform
    # Missing slug and path
  - slug: valid
    path: ./valid.yml
`;
        const content = new Map([["docs.yml", docsYml]]);
        const result = buildSlugToDocsYmlFilePath(content);

        expect(result.size).toBe(1);
        expect(result.get("valid")).toBe("valid.yml");
    });

    it("ignores versions without slug or path", () => {
        const docsYml = `
versions:
  - display-name: v2
    # Missing slug and path
  - slug: v1
    path: ./v1.yml
`;
        const content = new Map([["docs.yml", docsYml]]);
        const result = buildSlugToDocsYmlFilePath(content);

        expect(result.size).toBe(1);
        expect(result.get("v1")).toBe("v1.yml");
    });

    it("handles invalid yaml gracefully", () => {
        const docsYml = `
invalid yaml: [
  this is not valid
`;
        const content = new Map([["docs.yml", docsYml]]);
        const result = buildSlugToDocsYmlFilePath(content);

        // Should return empty map without throwing
        expect(result).toBeInstanceOf(Map);
        expect(result.size).toBe(0);
    });

    it("parses real-world example with products containing versions (Plant Store)", () => {
        // This is the actual configuration from the user's bug report that was failing
        const docsYml = `
instances:
  - url: acmeco.docs.buildwithfern.com
title: Plant Store
layout:
  searchbar-placement: header
  page-width: full
  tabs-placement: header
products:
  - display-name: Platform
    path: docs/products/platform/v2.yml
    versions:
      - display-name: v2
        path: docs/products/platform/v2.yml
        availability: stable
      - display-name: v1
        path: docs/products/platform/v1.yml
  - display-name: Wiki
    path: docs/products/wiki.yml
colors:
  accentPrimary:
    dark: '#81C784'
    light: '#1B5E20'
logo:
  dark: docs/assets/logo-dark.svg
  light: docs/assets/logo-light.svg
  height: 20
  href: https://buildwithfern.com/?utm_campaign=demo&utm_medium=plantstore&utm_source=logo
favicon: docs/assets/favicon.svg
`;
        const content = new Map([["docs.yml", docsYml]]);
        const result = buildSlugToDocsYmlFilePath(content);

        // Should not throw and return a valid Map with derived slugs
        expect(result).toBeInstanceOf(Map);

        // Products and versions don't have explicit slugs, so slugs are derived from paths
        // Derived slugs: "v2" (from platform/v2.yml), "v1" (from platform/v1.yml), "wiki" (from wiki.yml)
        expect(result.size).toBe(3);
        expect(result.get("v2")).toBe("docs/products/platform/v2.yml");
        expect(result.get("v1")).toBe("docs/products/platform/v1.yml");
        expect(result.get("wiki")).toBe("docs/products/wiki.yml");
    });
});
