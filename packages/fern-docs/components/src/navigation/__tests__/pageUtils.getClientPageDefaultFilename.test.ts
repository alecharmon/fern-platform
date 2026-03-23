import * as FernNavigation from "@fern-api/fdr-sdk/navigation";
import { describe, expect, it } from "vitest";
import { extractDirectoryFromSiblingPages, getClientPageDefaultFilename } from "../pageUtils";
import type { PageContainerWithTraversalContext, SectionAncestorMetadata } from "../types";

describe("getClientPageDefaultFilename", () => {
    it("uses slug directly when no directoryPrefix is provided", () => {
        expect(getClientPageDefaultFilename("agent-studio/new-page")).toBe("docs/pages/agent-studio/new-page.mdx");
    });

    it("preserves directory casing when directoryPrefix is provided", () => {
        expect(getClientPageDefaultFilename("agent-studio/new-page", "docs/pages/Agent-Studio")).toBe(
            "docs/pages/Agent-Studio/new-page.mdx"
        );
    });

    it("preserves deeply nested directory casing when prefix is provided", () => {
        expect(
            getClientPageDefaultFilename("agent-studio/core-concepts/new-page", "docs/pages/Agent-Studio/Core-Concepts")
        ).toBe("docs/pages/Agent-Studio/Core-Concepts/new-page.mdx");
    });

    it("uses directoryPrefix directly even when path structure differs from docs/pages convention", () => {
        // Folder at docs/guides/ — directoryPrefix is "docs/guides", slug is "docs/guides/guides/test"
        expect(getClientPageDefaultFilename("docs/guides/guides/test", "docs/guides")).toBe("docs/guides/test.mdx");
    });

    it("uses last slug segment as filename when directoryPrefix is provided", () => {
        // Even with deeply nested slug, only the last segment becomes the filename
        expect(getClientPageDefaultFilename("v2/platform/getting-started/new-page", "docs/pages/getting-started")).toBe(
            "docs/pages/getting-started/new-page.mdx"
        );
    });

    it("handles directoryPrefix with trailing slash", () => {
        expect(getClientPageDefaultFilename("agent-studio/new-page", "docs/pages/Agent-Studio/")).toBe(
            "docs/pages/Agent-Studio/new-page.mdx"
        );
    });

    it("handles directoryPrefix longer than directory portion", () => {
        expect(getClientPageDefaultFilename("new-page", "docs/pages/Agent-Studio/deep/nested")).toBe(
            "docs/pages/Agent-Studio/deep/nested/new-page.mdx"
        );
    });

    it("handles simple slug without slashes", () => {
        expect(getClientPageDefaultFilename("new-page")).toBe("docs/pages/new-page.mdx");
    });

    it("handles simple slug with directoryPrefix", () => {
        expect(getClientPageDefaultFilename("new-page", "docs/pages")).toBe("docs/pages/new-page.mdx");
    });
});

describe("extractDirectoryFromSiblingPages", () => {
    const createSectionContainer = (children: FernNavigation.NavigationChild[]): PageContainerWithTraversalContext => {
        const sectionPath: SectionAncestorMetadata[] = [
            {
                id: FernNavigation.NodeId("root"),
                type: "sidebarRoot",
                title: null
            },
            {
                id: FernNavigation.NodeId("section-1"),
                type: "section",
                title: "Agent Studio"
            }
        ];

        return {
            type: "section",
            id: FernNavigation.NodeId("section-1"),
            title: "Agent Studio",
            slug: FernNavigation.Slug("agent-studio"),
            canonicalSlug: undefined,
            icon: undefined,
            hidden: undefined,
            authed: undefined,
            viewers: undefined,
            orphaned: undefined,
            featureFlags: undefined,
            collapsed: undefined,
            collapsible: undefined,
            collapsedByDefault: undefined,
            overviewPageId: undefined,
            noindex: undefined,
            pointsTo: undefined,
            availability: undefined,
            children,
            sectionPath
        };
    };

    it("extracts directory from existing sibling page with original casing", () => {
        const container = createSectionContainer([
            {
                type: "page",
                id: FernNavigation.NodeId("page-1"),
                pageId: FernNavigation.PageId("docs/pages/Agent-Studio/agent-studio-overview.mdx"),
                title: "Overview",
                slug: FernNavigation.Slug("agent-studio/overview"),
                canonicalSlug: undefined,
                icon: undefined,
                hidden: undefined,
                authed: undefined,
                viewers: undefined,
                orphaned: undefined,
                noindex: undefined,
                featureFlags: undefined,
                availability: undefined,
                collapsed: undefined
            }
        ]);

        expect(extractDirectoryFromSiblingPages(container)).toBe("docs/pages/Agent-Studio");
    });

    it("returns undefined when no sibling pages exist", () => {
        const container = createSectionContainer([]);
        expect(extractDirectoryFromSiblingPages(container)).toBeUndefined();
    });

    it("returns undefined when siblings have no directory in pageId", () => {
        const container = createSectionContainer([
            {
                type: "page",
                id: FernNavigation.NodeId("page-1"),
                pageId: FernNavigation.PageId("overview.mdx"),
                title: "Overview",
                slug: FernNavigation.Slug("overview"),
                canonicalSlug: undefined,
                icon: undefined,
                hidden: undefined,
                authed: undefined,
                viewers: undefined,
                orphaned: undefined,
                noindex: undefined,
                featureFlags: undefined,
                availability: undefined,
                collapsed: undefined
            }
        ]);

        expect(extractDirectoryFromSiblingPages(container)).toBeUndefined();
    });

    it("preserves deeply nested directory casing", () => {
        const container = createSectionContainer([
            {
                type: "page",
                id: FernNavigation.NodeId("page-1"),
                pageId: FernNavigation.PageId("docs/pages/Agent-Studio/Core-Concepts/intro.mdx"),
                title: "Intro",
                slug: FernNavigation.Slug("agent-studio/core-concepts/intro"),
                canonicalSlug: undefined,
                icon: undefined,
                hidden: undefined,
                authed: undefined,
                viewers: undefined,
                orphaned: undefined,
                noindex: undefined,
                featureFlags: undefined,
                availability: undefined,
                collapsed: undefined
            }
        ]);

        expect(extractDirectoryFromSiblingPages(container)).toBe("docs/pages/Agent-Studio/Core-Concepts");
    });
});
