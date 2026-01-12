/**
 * PythonRenderer - Convert PythonLibraryDocsIR to RenderedLibraryDocs.
 *
 * This is the main entry point for rendering Python library documentation
 * from IR to MDX format, ready for merging into a DocsDefinition.
 */

import type { FdrLambda } from "@fern-api/fdr-lambda-sdk";
import { createHash } from "crypto";
import type { FernRegistry } from "../../../../api/generated/index.js";
import type { NavNode } from "../base/index.js";
import { type RenderConfig, renderAllModulePages } from "./ModuleRenderer.js";

/**
 * Configuration for rendering library docs.
 */
export interface PythonRendererConfig {
    /** URL slug prefix for library docs pages. Defaults to "library-docs". */
    slug?: string;
    /** Navigation section title. Defaults to "Library Reference". */
    title?: string;
}

/**
 * Generate a stable node ID from a string.
 * Uses hash to ensure IDs are stable across renders for the same input.
 */
function generateNodeId(input: string): FernRegistry.navigation.v1.NodeId {
    const hash = createHash("sha256").update(input).digest("hex").slice(0, 12);
    return `libdocs_${hash}` as FernRegistry.navigation.v1.NodeId;
}

/**
 * Renderer for Python library documentation.
 *
 * Takes PythonLibraryDocsIR (from Lambda) and produces RenderedLibraryDocs
 * ready for merging into a DocsDefinition.
 */
export class PythonRenderer {
    private slug: string;
    private title: string;
    private renderConfig: RenderConfig;

    constructor(config: PythonRendererConfig = {}) {
        this.slug = config.slug ?? "library-docs";
        this.title = config.title ?? "Library Reference";
        this.renderConfig = { baseSlug: this.slug };
    }

    /**
     * Render IR to RenderedLibraryDocs (Fern-generated type).
     *
     * Returns pages and a navigation SectionNode ready for merging
     * into a DocsDefinition.
     */
    render(ir: FdrLambda.libraryDocs.PythonLibraryDocsIr): FernRegistry.docs.v2.write.RenderedLibraryDocs {
        // Render all module pages (keyed by pageId)
        const rawPages = renderAllModulePages(ir.rootModule, this.renderConfig);

        // Convert to Fern-generated PageContent type
        const pages: Record<FernRegistry.PageId, FernRegistry.docs.v1.write.PageContent> = {};
        for (const [pageId, markdown] of Object.entries(rawPages)) {
            pages[pageId as FernRegistry.PageId] = {
                markdown,
                editThisPageUrl: undefined,
                rawMarkdown: undefined
            };
        }

        // Generate navigation from module tree
        const navItems = this.generateModuleNav(ir.rootModule, "");

        // Build the wrapper SectionNode
        const sectionNode = this.buildSectionNode(navItems);

        return { pages, sectionNode };
    }

    /**
     * Build the wrapper SectionNode containing all navigation items.
     */
    private buildSectionNode(navItems: NavNode[]): FernRegistry.navigation.v1.SectionNode {
        return {
            type: "section",
            id: generateNodeId(`libdocs:${this.slug}`),
            title: this.title,
            slug: this.slug as FernRegistry.navigation.v1.Slug,
            children: navItems.map((item) => this.convertNavNode(item)),
            // Optional fields
            icon: undefined,
            hidden: undefined,
            authed: undefined,
            viewers: undefined,
            orphaned: undefined,
            featureFlags: undefined,
            overviewPageId: undefined,
            noindex: undefined,
            pointsTo: undefined,
            collapsed: undefined,
            availability: undefined
        };
    }

    /**
     * Convert internal NavNode to FDR NavigationChild.
     */
    private convertNavNode(node: NavNode): FernRegistry.navigation.v1.NavigationChild {
        if (node.type === "page") {
            const pageNode: FernRegistry.navigation.v1.PageNode = {
                type: "page",
                id: generateNodeId(`page:${node.pageId}`),
                title: node.title,
                slug: node.slug as FernRegistry.navigation.v1.Slug,
                pageId: node.pageId as FernRegistry.PageId,
                // Optional fields
                icon: undefined,
                hidden: undefined,
                authed: undefined,
                viewers: undefined,
                orphaned: undefined,
                featureFlags: undefined,
                noindex: undefined,
                availability: undefined
            };
            return pageNode;
        } else {
            const sectionNode: FernRegistry.navigation.v1.SectionNode = {
                type: "section",
                id: generateNodeId(`section:${node.slug}`),
                title: node.title,
                slug: node.slug as FernRegistry.navigation.v1.Slug,
                children: node.children.map((child) => this.convertNavNode(child)),
                // Optional fields
                icon: undefined,
                hidden: undefined,
                authed: undefined,
                viewers: undefined,
                orphaned: undefined,
                featureFlags: undefined,
                overviewPageId: undefined,
                noindex: undefined,
                pointsTo: undefined,
                collapsed: undefined,
                availability: undefined
            };
            return sectionNode;
        }
    }

    /**
     * Recursively generate navigation for a module and its children.
     * Returns NavNode[] with stable slugs derived from module paths.
     */
    private generateModuleNav(module: FdrLambda.libraryDocs.PythonModuleIr, parentPath: string): NavNode[] {
        const items: NavNode[] = [];
        const modulePath = parentPath ? `${parentPath}/${module.name}` : module.name;
        const slug = `${this.slug}/${modulePath}`;
        const pageId = `${slug}.mdx`;

        // Check if module has content worth showing
        const hasContent =
            module.classes.length > 0 ||
            module.functions.length > 0 ||
            module.attributes.length > 0 ||
            module.docstring != null;

        // Add page for this module if it has content
        if (hasContent) {
            items.push({
                type: "page",
                title: module.name,
                slug,
                pageId
            });
        }

        // Process submodules
        for (const submodule of module.submodules) {
            const subItems = this.generateModuleNav(submodule, modulePath);

            if (subItems.length === 0) {
                // No items - skip
                continue;
            } else if (subItems.length === 1) {
                // Single item - add directly (whether page or section)
                items.push(subItems[0]!);
            } else {
                // Multiple items - create a section with stable slug from module path
                const submodulePath = `${modulePath}/${submodule.name}`;
                items.push({
                    type: "section",
                    title: submodule.name,
                    slug: `${this.slug}/${submodulePath}`,
                    children: subItems
                });
            }
        }

        return items;
    }
}
