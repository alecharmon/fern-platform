import type { FernNavigation } from "@fern-api/fdr-sdk";
import { beforeEach, describe, expect, it } from "vitest";
import { NavigationStore } from "../NavigationStore";

describe("NavigationStore - createClientPage in product with nested versions", () => {
    let store: NavigationStore;

    beforeEach(() => {
        store = new NavigationStore("test-branch", "test-org", "https://test.com");
    });

    it("should write page to product yml file when creating page in section inside product with nested versions", async () => {
        // Reproduce the bug: Create page inside section ← tab ← version ← product
        // Expected: Page should be written to docs/products/platform/v2.yml
        // Bug: Page was being written to docs.yml instead

        // Setup: Create a docs.yml structure similar to Plant Store
        const docsYmlContent = `
instances:
  - url: test.docs.buildwithfern.com
title: Test Docs
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
`;

        const platformV2Content = `
navigation:
  - tab: guides
    layout:
      - section: Getting Started
        contents:
          - page: Introduction
            path: docs/pages/introduction.mdx
`;

        const docsYmlBaseContent = new Map([
            ["docs.yml", docsYmlContent],
            ["docs/products/platform/v2.yml", platformV2Content],
            ["docs/products/platform/v1.yml", "navigation: []"],
            ["docs/products/wiki.yml", "navigation: []"]
        ]);

        // Hydrate the store with the docs.yml content
        await store.hydrate({ latestDocsYmlAndReferences: docsYmlBaseContent });

        // Create root node structure matching the docs.yml
        const rootNode: FernNavigation.RootNode = {
            type: "root",
            id: "root" as FernNavigation.NodeId,
            version: "v2",
            title: "Root",
            slug: "root" as FernNavigation.Slug,
            canonicalSlug: undefined,
            icon: undefined,
            hidden: undefined,
            authed: undefined,
            viewers: undefined,
            orphaned: undefined,
            featureFlags: undefined,
            pointsTo: undefined,
            roles: undefined,
            child: {
                type: "unversioned",
                id: "unversioned" as FernNavigation.NodeId,
                landingPage: undefined,
                child: {
                    type: "productgroup" as any,
                    id: "productgroup" as FernNavigation.NodeId,
                    children: [
                        {
                            type: "product" as any,
                            id: "product-platform" as FernNavigation.NodeId,
                            slug: "v2" as FernNavigation.Slug, // Derived from path
                            title: "Platform",
                            child: {
                                type: "versioned" as any,
                                id: "versioned-platform" as FernNavigation.NodeId,
                                children: [
                                    {
                                        type: "version" as any,
                                        id: "version-v2" as FernNavigation.NodeId,
                                        slug: "v2" as FernNavigation.Slug,
                                        title: "v2",
                                        default: true,
                                        versionId: "v2" as FernNavigation.VersionId,
                                        canonicalSlug: undefined,
                                        icon: undefined,
                                        hidden: undefined,
                                        authed: undefined,
                                        viewers: undefined,
                                        orphaned: undefined,
                                        featureFlags: undefined,
                                        pointsTo: undefined,
                                        availability: "stable" as any,
                                        landingPage: undefined,
                                        announcement: undefined,
                                        child: {
                                            type: "tabbed",
                                            id: "tabbed" as FernNavigation.NodeId,
                                            children: [
                                                {
                                                    type: "tab",
                                                    id: "tab-guides" as FernNavigation.NodeId,
                                                    slug: "guides" as FernNavigation.Slug,
                                                    title: "Guides",
                                                    icon: undefined,
                                                    hidden: undefined,
                                                    authed: undefined,
                                                    viewers: undefined,
                                                    orphaned: undefined,
                                                    featureFlags: undefined,
                                                    child: {
                                                        type: "sidebarRoot",
                                                        id: "sidebar-root-guides" as FernNavigation.NodeId,
                                                        children: [
                                                            {
                                                                type: "section",
                                                                id: "section-getting-started" as FernNavigation.NodeId,
                                                                title: "Getting Started",
                                                                slug: "getting-started" as FernNavigation.Slug,
                                                                collapsed: false,
                                                                overviewPageId: undefined,
                                                                canonicalSlug: undefined,
                                                                icon: undefined,
                                                                hidden: undefined,
                                                                authed: undefined,
                                                                viewers: undefined,
                                                                orphaned: undefined,
                                                                featureFlags: undefined,
                                                                noindex: undefined,
                                                                availability: undefined,
                                                                pointsTo: undefined,
                                                                children: [
                                                                    {
                                                                        type: "page",
                                                                        id: "page-intro" as FernNavigation.NodeId,
                                                                        pageId: "docs/pages/introduction.mdx" as FernNavigation.PageId,
                                                                        title: "Introduction",
                                                                        slug: "introduction" as FernNavigation.Slug,
                                                                        canonicalSlug: undefined,
                                                                        icon: undefined,
                                                                        hidden: undefined,
                                                                        authed: undefined,
                                                                        viewers: undefined,
                                                                        orphaned: undefined,
                                                                        featureFlags: undefined,
                                                                        noindex: undefined,
                                                                        availability: undefined
                                                                    }
                                                                ]
                                                            }
                                                        ]
                                                    }
                                                }
                                            ]
                                        }
                                    } as any
                                ]
                            }
                        } as any
                    ]
                }
            }
        };

        // Set the root node
        store.setRootNode(rootNode);

        // Create a baseFoundNode (simulating the user being on the Introduction page)
        const baseFoundNode = {
            type: "found" as const,
            node: {} as any,
            parents: [],
            sidebar: undefined,
            tabs: [],
            currentTab: { slug: "guides" } as any,
            currentVersion: {
                slug: "v2",
                id: "version-v2" as FernNavigation.NodeId,
                title: "v2"
            } as any,
            currentProduct: {
                slug: "v2", // Note: Product slug is also "v2" (derived from path)
                type: "product",
                id: "product-platform" as FernNavigation.NodeId,
                title: "Platform"
            } as any,
            currentVariant: undefined,
            isCurrentVersionDefault: true,
            isCurrentProductDefault: true
        };

        // Create a new page in the "Getting Started" section
        const newPageMdx = `---
title: Quickstart
slug: quickstart
---

# Quickstart

This is a quickstart guide.
`;

        store.createClientPage("docs/pages/quickstart.mdx", {
            source: "client",
            filename: "docs/pages/quickstart.mdx",
            initialMdx: newPageMdx,
            baseFoundNode,
            targetSectionPath: [
                {
                    id: "sidebar-root-guides" as FernNavigation.NodeId,
                    type: "sidebarRoot",
                    title: null
                },
                {
                    id: "section-getting-started" as FernNavigation.NodeId,
                    type: "section",
                    title: "Getting Started"
                }
            ]
        });

        // Get the files that would be written
        const files = store.files;

        // The page should be written to the product yml file, NOT to docs.yml
        expect(files.changed["docs/products/platform/v2.yml"]).toBeDefined();
        expect(files.changed["docs/products/platform/v2.yml"]).toContain("Quickstart");

        // Root docs.yml should NOT be modified
        expect(files.changed["docs.yml"]).toBeUndefined();
    });

    it("should write page to root docs.yml when creating page in root-level section", async () => {
        // Verify that pages in root docs still go to docs.yml

        const docsYmlContent = `
navigation:
  - section: Overview
    contents: []
`;

        const docsYmlBaseContent = new Map([["docs.yml", docsYmlContent]]);

        // Hydrate the store with the docs.yml content
        await store.hydrate({ latestDocsYmlAndReferences: docsYmlBaseContent });

        const rootNode: FernNavigation.RootNode = {
            type: "root",
            id: "root" as FernNavigation.NodeId,
            version: "v2",
            title: "Root",
            slug: "root" as FernNavigation.Slug,
            canonicalSlug: undefined,
            icon: undefined,
            hidden: undefined,
            authed: undefined,
            viewers: undefined,
            orphaned: undefined,
            featureFlags: undefined,
            pointsTo: undefined,
            roles: undefined,
            child: {
                type: "unversioned",
                id: "unversioned" as FernNavigation.NodeId,
                landingPage: undefined,
                child: {
                    type: "sidebarRoot",
                    id: "sidebar-root" as FernNavigation.NodeId,
                    children: [
                        {
                            type: "section",
                            id: "section-overview" as FernNavigation.NodeId,
                            title: "Overview",
                            slug: "overview" as FernNavigation.Slug,
                            collapsed: false,
                            overviewPageId: undefined,
                            canonicalSlug: undefined,
                            icon: undefined,
                            hidden: undefined,
                            authed: undefined,
                            viewers: undefined,
                            orphaned: undefined,
                            featureFlags: undefined,
                            noindex: undefined,
                            availability: undefined,
                            pointsTo: undefined,
                            children: []
                        }
                    ]
                }
            }
        };

        store.setRootNode(rootNode);

        const baseFoundNode = {
            type: "found" as const,
            node: {} as any,
            parents: [],
            sidebar: undefined,
            tabs: [],
            currentTab: undefined,
            currentVersion: undefined,
            currentProduct: undefined,
            currentVariant: undefined,
            isCurrentVersionDefault: true,
            isCurrentProductDefault: true
        };

        const newPageMdx = `---
title: New Page
slug: new-page
---

# New Page
`;

        store.createClientPage("docs/pages/new-page.mdx", {
            source: "client",
            filename: "docs/pages/new-page.mdx",
            initialMdx: newPageMdx,
            baseFoundNode,
            targetSectionPath: [
                {
                    id: "sidebar-root" as FernNavigation.NodeId,
                    type: "sidebarRoot",
                    title: null
                },
                {
                    id: "section-overview" as FernNavigation.NodeId,
                    type: "section",
                    title: "Overview"
                }
            ]
        });

        // Get the files that would be written
        const files = store.files;

        // The page should be written to root docs.yml
        expect(files.changed["docs.yml"]).toBeDefined();
        expect(files.changed["docs.yml"]).toContain("New Page");
    });

    it("should write page to new section name when section is renamed after page creation", async () => {
        // Reproduce the bug: Create page in section, then rename the section
        // Expected: Page should be written under the NEW section name in YAML
        // Bug: Page is written under the OLD section name

        const docsYmlContent = `
navigation:
  - section: Overview
    contents: []
`;

        const docsYmlBaseContent = new Map([["docs.yml", docsYmlContent]]);

        // Hydrate the store with the docs.yml content
        await store.hydrate({ latestDocsYmlAndReferences: docsYmlBaseContent });

        const rootNode: FernNavigation.RootNode = {
            type: "root",
            id: "root" as FernNavigation.NodeId,
            version: "v2",
            title: "Root",
            slug: "root" as FernNavigation.Slug,
            canonicalSlug: undefined,
            icon: undefined,
            hidden: undefined,
            authed: undefined,
            viewers: undefined,
            orphaned: undefined,
            featureFlags: undefined,
            pointsTo: undefined,
            roles: undefined,
            child: {
                type: "unversioned",
                id: "unversioned" as FernNavigation.NodeId,
                landingPage: undefined,
                child: {
                    type: "sidebarRoot",
                    id: "sidebar-root" as FernNavigation.NodeId,
                    children: [
                        {
                            type: "section",
                            id: "section-overview" as FernNavigation.NodeId,
                            title: "Overview",
                            slug: "overview" as FernNavigation.Slug,
                            collapsed: false,
                            overviewPageId: undefined,
                            canonicalSlug: undefined,
                            icon: undefined,
                            hidden: undefined,
                            authed: undefined,
                            viewers: undefined,
                            orphaned: undefined,
                            featureFlags: undefined,
                            noindex: undefined,
                            availability: undefined,
                            pointsTo: undefined,
                            children: []
                        }
                    ]
                }
            }
        };

        store.setRootNode(rootNode);

        const baseFoundNode = {
            type: "found" as const,
            node: {} as any,
            parents: [],
            sidebar: undefined,
            tabs: [],
            currentTab: undefined,
            currentVersion: undefined,
            currentProduct: undefined,
            currentVariant: undefined,
            isCurrentVersionDefault: true,
            isCurrentProductDefault: true
        };

        // Step 1: Create a new page in the "Overview" section
        const newPageMdx = `---
title: New Page
slug: new-page
---

# New Page
`;

        store.createClientPage("docs/pages/new-page.mdx", {
            source: "client",
            filename: "docs/pages/new-page.mdx",
            initialMdx: newPageMdx,
            baseFoundNode,
            targetSectionPath: [
                {
                    id: "sidebar-root" as FernNavigation.NodeId,
                    type: "sidebarRoot",
                    title: null
                },
                {
                    id: "section-overview" as FernNavigation.NodeId,
                    type: "section",
                    title: "Overview"
                }
            ]
        });

        // Step 2: Rename the section from "Overview" to "EDIT SECTION"
        store.renameSection("section-overview" as FernNavigation.NodeId, "EDIT SECTION");

        // Get the files that would be written
        const files = store.files;

        // The page should be written under the NEW section name
        expect(files.changed["docs.yml"]).toBeDefined();
        const ymlContent = files.changed["docs.yml"]!;

        // Should contain the new section name
        expect(ymlContent).toContain("EDIT SECTION");

        // Should NOT contain "Overview" as a section (it was renamed)
        // Note: The YAML should have "section: EDIT SECTION" not "section: Overview"
        const lines = ymlContent.split("\n");
        const sectionLineIndex = lines.findIndex((line) => line.includes("section:"));
        expect(sectionLineIndex).toBeGreaterThan(-1);
        expect(lines[sectionLineIndex]).toContain("EDIT SECTION");
        expect(lines[sectionLineIndex]).not.toContain("Overview");
    });

    it("should handle section rename when section already has existing pages in base YAML", async () => {
        // This test replicates the real-world scenario where:
        // 1. Section "Overview" exists in base YAML with existing pages
        // 2. User adds a new page to "Overview"
        // 3. User renames "Overview" to "EDIT SECTION"
        // Expected: ALL pages (existing + new) should appear under "EDIT SECTION"
        // Bug: New page appears under "Overview", existing pages appear under "EDIT SECTION"

        const docsYmlContent = `
navigation:
  - section: Overview
    contents:
      - page: PAGE A
        path: ./docs/pages/learn/platform/guides/overview/page-a.mdx
`;

        const docsYmlBaseContent = new Map([["docs.yml", docsYmlContent]]);

        // Hydrate the store with the docs.yml content
        await store.hydrate({ latestDocsYmlAndReferences: docsYmlBaseContent });

        const rootNode: FernNavigation.RootNode = {
            type: "root",
            id: "root" as FernNavigation.NodeId,
            version: "v2",
            title: "Root",
            slug: "root" as FernNavigation.Slug,
            canonicalSlug: undefined,
            icon: undefined,
            hidden: undefined,
            authed: undefined,
            viewers: undefined,
            orphaned: undefined,
            featureFlags: undefined,
            pointsTo: undefined,
            roles: undefined,
            child: {
                type: "unversioned",
                id: "unversioned" as FernNavigation.NodeId,
                landingPage: undefined,
                child: {
                    type: "sidebarRoot",
                    id: "sidebar-root" as FernNavigation.NodeId,
                    children: [
                        {
                            type: "section",
                            id: "section-overview" as FernNavigation.NodeId,
                            title: "Overview",
                            slug: "overview" as FernNavigation.Slug,
                            collapsed: false,
                            overviewPageId: undefined,
                            canonicalSlug: undefined,
                            icon: undefined,
                            hidden: undefined,
                            authed: undefined,
                            viewers: undefined,
                            orphaned: undefined,
                            featureFlags: undefined,
                            noindex: undefined,
                            availability: undefined,
                            pointsTo: undefined,
                            children: [
                                {
                                    type: "page",
                                    id: "page-a" as FernNavigation.NodeId,
                                    pageId: "docs/pages/learn/platform/guides/overview/page-a.mdx" as FernNavigation.PageId,
                                    title: "PAGE A",
                                    slug: "page-a" as FernNavigation.Slug,
                                    canonicalSlug: undefined,
                                    icon: undefined,
                                    hidden: undefined,
                                    authed: undefined,
                                    viewers: undefined,
                                    orphaned: undefined,
                                    featureFlags: undefined,
                                    noindex: undefined,
                                    availability: undefined
                                }
                            ]
                        }
                    ]
                }
            }
        };

        store.setRootNode(rootNode);

        const baseFoundNode = {
            type: "found" as const,
            node: {} as any,
            parents: [],
            sidebar: undefined,
            tabs: [],
            currentTab: undefined,
            currentVersion: undefined,
            currentProduct: undefined,
            currentVariant: undefined,
            isCurrentVersionDefault: true,
            isCurrentProductDefault: true
        };

        // Step 1: Create a new page "PAGE B" in the "Overview" section
        const pageBMdx = `---
title: PAGE B
slug: page-b
---

# PAGE B
`;

        store.createClientPage("docs/pages/learn/platform/guides/overview/page-b.mdx", {
            source: "client",
            filename: "docs/pages/learn/platform/guides/overview/page-b.mdx",
            initialMdx: pageBMdx,
            baseFoundNode,
            targetSectionPath: [
                {
                    id: "sidebar-root" as FernNavigation.NodeId,
                    type: "sidebarRoot",
                    title: null
                },
                {
                    id: "section-overview" as FernNavigation.NodeId,
                    type: "section",
                    title: "Overview"
                }
            ]
        });

        // Step 2: Rename the section from "Overview" to "EDIT SECTION"
        store.renameSection("section-overview" as FernNavigation.NodeId, "EDIT SECTION");

        // Get the files that would be written
        const files = store.files;

        // The YAML should be written
        expect(files.changed["docs.yml"]).toBeDefined();
        const ymlContent = files.changed["docs.yml"]!;

        // Should contain the new section name
        expect(ymlContent).toContain("EDIT SECTION");

        // Should NOT contain "Overview" as a section name anywhere
        // Parse the YAML to check structure
        const lines = ymlContent.split("\n");

        // Count how many times "section:" appears (should be 1, not 2)
        const sectionLines = lines.filter((line) => line.trim().startsWith("- section:"));
        expect(sectionLines.length).toBe(1);

        // That one section should be "EDIT SECTION"
        expect(sectionLines[0]).toContain("EDIT SECTION");
        expect(sectionLines[0]).not.toContain("Overview");

        // Both pages should appear in the YAML under the renamed section
        expect(ymlContent).toContain("PAGE A");
        expect(ymlContent).toContain("PAGE B");
    });

    it("should NOT update pages in different yml files when renaming section", async () => {
        // This test replicates a potential bug where renaming a section in one yml file
        // incorrectly updates add_page changes in a DIFFERENT yml file with the same section name
        // Expected: Section rename in product-a.yml should NOT affect pages in docs.yml
        // Bug: If docsYmlFilePath matching is missing, it will incorrectly update unrelated pages

        const docsYmlContent = `
navigation:
  - section: Overview
    contents:
      - page: Root Page
        path: ./docs/pages/root-page.mdx

products:
  - display-name: Product A
    slug: product-a
    path: products/product-a.yml
`;

        const productAContent = `
navigation:
  - section: Overview
    contents:
      - page: Product Page
        path: ./docs/pages/product-page.mdx
`;

        const docsYmlBaseContent = new Map([
            ["docs.yml", docsYmlContent],
            ["products/product-a.yml", productAContent]
        ]);

        // Hydrate the store
        await store.hydrate({ latestDocsYmlAndReferences: docsYmlBaseContent });

        // Create root node with BOTH a root-level section AND a product-level section, both named "Overview"
        const rootNode: FernNavigation.RootNode = {
            type: "root",
            id: "root" as FernNavigation.NodeId,
            version: "v2",
            title: "Root",
            slug: "root" as FernNavigation.Slug,
            canonicalSlug: undefined,
            icon: undefined,
            hidden: undefined,
            authed: undefined,
            viewers: undefined,
            orphaned: undefined,
            featureFlags: undefined,
            pointsTo: undefined,
            roles: undefined,
            child: {
                type: "unversioned",
                id: "unversioned" as FernNavigation.NodeId,
                landingPage: undefined,
                child: {
                    type: "productgroup" as any,
                    id: "productgroup" as FernNavigation.NodeId,
                    children: [
                        {
                            type: "product" as any,
                            id: "product-a" as FernNavigation.NodeId,
                            slug: "product-a" as FernNavigation.Slug,
                            title: "Product A",
                            child: {
                                type: "sidebarRoot",
                                id: "sidebar-root-product-a" as FernNavigation.NodeId,
                                children: [
                                    {
                                        type: "section",
                                        id: "section-overview-product-a" as FernNavigation.NodeId,
                                        title: "Overview",
                                        slug: "overview" as FernNavigation.Slug,
                                        collapsed: false,
                                        overviewPageId: undefined,
                                        canonicalSlug: undefined,
                                        icon: undefined,
                                        hidden: undefined,
                                        authed: undefined,
                                        viewers: undefined,
                                        orphaned: undefined,
                                        featureFlags: undefined,
                                        noindex: undefined,
                                        availability: undefined,
                                        pointsTo: undefined,
                                        children: []
                                    }
                                ]
                            }
                        } as any
                    ]
                }
            }
        };

        store.setRootNode(rootNode);

        // Context for root-level docs.yml
        const rootFoundNode = {
            type: "found" as const,
            node: {} as any,
            parents: [],
            sidebar: undefined,
            tabs: [],
            currentTab: undefined,
            currentVersion: undefined,
            currentProduct: undefined,
            currentVariant: undefined,
            isCurrentVersionDefault: true,
            isCurrentProductDefault: true
        };

        // Context for product-a.yml
        const productFoundNode = {
            type: "found" as const,
            node: {} as any,
            parents: [],
            sidebar: undefined,
            tabs: [],
            currentTab: undefined,
            currentVersion: undefined,
            currentProduct: {
                slug: "product-a",
                type: "product",
                id: "product-a" as FernNavigation.NodeId,
                title: "Product A"
            } as any,
            currentVariant: undefined,
            isCurrentVersionDefault: true,
            isCurrentProductDefault: true
        };

        // Step 1: Add a new page to the root-level "Overview" section (docs.yml)
        const rootNewPageMdx = `---
title: New Root Page
slug: new-root-page
---

# New Root Page
`;

        store.createClientPage("docs/pages/new-root-page.mdx", {
            source: "client",
            filename: "docs/pages/new-root-page.mdx",
            initialMdx: rootNewPageMdx,
            baseFoundNode: rootFoundNode,
            targetSectionPath: [
                {
                    id: "sidebar-root" as FernNavigation.NodeId,
                    type: "sidebarRoot",
                    title: null
                },
                {
                    id: "section-overview-root" as FernNavigation.NodeId,
                    type: "section",
                    title: "Overview"
                }
            ]
        });

        // Step 2: Add a new page to the product-level "Overview" section (products/product-a.yml)
        const productNewPageMdx = `---
title: New Product Page
slug: new-product-page
---

# New Product Page
`;

        store.createClientPage("docs/pages/new-product-page.mdx", {
            source: "client",
            filename: "docs/pages/new-product-page.mdx",
            initialMdx: productNewPageMdx,
            baseFoundNode: productFoundNode,
            targetSectionPath: [
                {
                    id: "sidebar-root-product-a" as FernNavigation.NodeId,
                    type: "sidebarRoot",
                    title: null
                },
                {
                    id: "section-overview-product-a" as FernNavigation.NodeId,
                    type: "section",
                    title: "Overview"
                }
            ]
        });

        // Step 3: Rename ONLY the product-level "Overview" section to "Product Overview"
        store.renameSection("section-overview-product-a" as FernNavigation.NodeId, "Product Overview");

        // Get the files that would be written
        const files = store.files;

        // Root docs.yml should still have "Overview" section (NOT renamed)
        expect(files.changed["docs.yml"]).toBeDefined();
        const rootYml = files.changed["docs.yml"]!;
        expect(rootYml).toContain("- section: Overview"); // Root section should NOT be renamed
        expect(rootYml).toContain("New Root Page");
        expect(rootYml).not.toContain("Product Overview"); // Should NOT contain product section name

        // Product A yml should have renamed section "Product Overview"
        expect(files.changed["products/product-a.yml"]).toBeDefined();
        const productYml = files.changed["products/product-a.yml"]!;
        expect(productYml).toContain("- section: Product Overview"); // Product section SHOULD be renamed
        expect(productYml).toContain("New Product Page");
        expect(productYml).not.toContain("- section: Overview"); // Old name should not appear
    });
});
