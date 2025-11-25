import { describe, expect, it } from "vitest";
import { extractDocsYmlFilePathFromFoundNode } from "../pageUtils";
import type { DocsYmlFilePath, NavigationSlug } from "../types";

describe("extractDocsYmlFilePathFromFoundNode", () => {
    it("defaults to docs.yml when slugToDocsYmlFilePath is null", () => {
        const context = {
            currentVersion: undefined,
            currentProduct: undefined,
            currentTab: undefined
        };

        const result = extractDocsYmlFilePathFromFoundNode(context, undefined);
        expect(result).toBe("docs.yml");
    });

    it("finds file by version slug", () => {
        const slugMap = new Map<NavigationSlug, DocsYmlFilePath>([
            ["v2", "versions/v2.yml"],
            ["v1", "versions/v1.yml"]
        ]);

        const context = {
            currentVersion: { slug: "v2" } as any,
            currentProduct: undefined,
            currentTab: undefined
        };

        const result = extractDocsYmlFilePathFromFoundNode(context, slugMap);
        expect(result).toBe("versions/v2.yml");
    });

    it("finds file by product slug", () => {
        const slugMap = new Map<NavigationSlug, DocsYmlFilePath>([
            ["platform", "products/platform.yml"],
            ["wiki", "products/wiki.yml"]
        ]);

        const context = {
            currentVersion: undefined,
            currentProduct: { slug: "platform", type: "product" } as any,
            currentTab: undefined
        };

        const result = extractDocsYmlFilePathFromFoundNode(context, slugMap);
        expect(result).toBe("products/platform.yml");
    });

    it("finds file by tab slug", () => {
        const slugMap = new Map<NavigationSlug, DocsYmlFilePath>([
            ["home", "tabs/home.yml"],
            ["guides", "tabs/guides.yml"]
        ]);

        const context = {
            currentVersion: undefined,
            currentProduct: undefined,
            currentTab: { slug: "home" }
        };

        const result = extractDocsYmlFilePathFromFoundNode(context, slugMap);
        expect(result).toBe("tabs/home.yml");
    });

    it("prioritizes version over product when both are present", () => {
        const slugMap = new Map<NavigationSlug, DocsYmlFilePath>([
            ["platform", "products/platform.yml"],
            ["v2", "docs/products/platform/v2.yml"],
            ["v1", "docs/products/platform/v1.yml"]
        ]);

        const context = {
            currentVersion: { slug: "v2" } as any,
            currentProduct: { slug: "platform", type: "product" } as any,
            currentTab: undefined
        };

        const result = extractDocsYmlFilePathFromFoundNode(context, slugMap);
        expect(result).toBe("docs/products/platform/v2.yml");
    });

    it("handles Plant Store case: product with nested versions (derived slugs)", () => {
        // This reproduces the bug scenario from https://github.com/fern-demo/stephen-acmeco-fern-config/pull/242
        // In docs.yml:
        //   products:
        //     - display-name: Platform
        //       path: docs/products/platform/v2.yml  # No explicit slug, derived as "v2"
        //       versions:
        //         - display-name: v2
        //           path: docs/products/platform/v2.yml  # No explicit slug, derived as "v2"
        //         - display-name: v1
        //           path: docs/products/platform/v1.yml  # No explicit slug, derived as "v1"
        //     - display-name: Wiki
        //       path: docs/products/wiki.yml  # No explicit slug, derived as "wiki"
        //
        // The slug map will have:
        //   "v2" -> "docs/products/platform/v2.yml" (version entry overwrites product entry)
        //   "v1" -> "docs/products/platform/v1.yml"
        //   "wiki" -> "docs/products/wiki.yml"
        const slugMap = new Map<NavigationSlug, DocsYmlFilePath>([
            ["v2", "docs/products/platform/v2.yml"],
            ["v1", "docs/products/platform/v1.yml"],
            ["wiki", "docs/products/wiki.yml"]
        ]);

        // When editing a page in Platform product, v2 version:
        // - currentProduct.slug = "v2" (derived from product path)
        // - currentVersion.slug = "v2" (derived from version path)
        const context = {
            currentVersion: { slug: "v2" } as any,
            currentProduct: { slug: "v2", type: "product" } as any, // Product slug is also "v2"
            currentTab: undefined
        };

        const result = extractDocsYmlFilePathFromFoundNode(context, slugMap);

        // Should return the v2 version file, NOT "docs.yml"
        expect(result).toBe("docs/products/platform/v2.yml");
    });

    it("handles version slug with slash separator by trying last segment", () => {
        const slugMap = new Map<NavigationSlug, DocsYmlFilePath>([["v2", "versions/v2.yml"]]);

        const context = {
            currentVersion: { slug: "platform/v2" } as any, // Version slug contains slash
            currentProduct: undefined,
            currentTab: undefined
        };

        const result = extractDocsYmlFilePathFromFoundNode(context, slugMap);
        expect(result).toBe("versions/v2.yml");
    });

    it("handles product slug with slash separator by trying last segment", () => {
        const slugMap = new Map<NavigationSlug, DocsYmlFilePath>([["docs", "learn/docs.yml"]]);

        const context = {
            currentVersion: undefined,
            currentProduct: { slug: "learn/docs", type: "product" } as any, // Product slug contains slash
            currentTab: undefined
        };

        const result = extractDocsYmlFilePathFromFoundNode(context, slugMap);
        expect(result).toBe("learn/docs.yml");
    });

    it("defaults to docs.yml when no matching slug is found", () => {
        const slugMap = new Map<NavigationSlug, DocsYmlFilePath>([
            ["v2", "versions/v2.yml"],
            ["platform", "products/platform.yml"]
        ]);

        const context = {
            currentVersion: { slug: "v3" } as any, // Slug not in map
            currentProduct: undefined,
            currentTab: undefined
        };

        const result = extractDocsYmlFilePathFromFoundNode(context, slugMap);
        expect(result).toBe("docs.yml");
    });
});
