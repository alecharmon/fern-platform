import type * as FernNavigation from "@fern-api/fdr-sdk/navigation";
import { mdxToHtml } from "@fern-docs/mdx";

import type {
    ClientPageDataDependencies,
    NavigationSnapshot,
    PageDataDependencies,
    ResolvedPageData,
    SectionAncestorMetadata,
    SectionNodeWithTraversalContext,
    ServerPageDataDependencies
} from "./types";

// SECTIONS
// ----------------------------------------------------------------------------

/** Gets a flat list of all sections from a section node */
export function getAllSectionsFromSectionNode(
    sectionNode: SectionNodeWithTraversalContext
): SectionNodeWithTraversalContext[] {
    const result: SectionNodeWithTraversalContext[] = [];

    for (const child of sectionNode.children) {
        if (child.type === "section") {
            const section = {
                ...child,
                sectionPath: [
                    ...sectionNode.sectionPath,
                    {
                        id: sectionNode.id,
                        type: sectionNode.type,
                        title: sectionNode.title
                    }
                ]
            };
            result.push(section);
        }
    }
    return result;
}

/** Gets a flat list of all sections from a sidebar root node */
export function getAllSectionsFromSidebarRootNode(
    sidebarRootNode: FernNavigation.SidebarRootNode
): SectionNodeWithTraversalContext[] {
    const result: SectionNodeWithTraversalContext[] = [];

    const rootSectionPath: SectionAncestorMetadata[] = [
        {
            id: sidebarRootNode.id,
            type: sidebarRootNode.type,
            title: null
        }
    ];
    for (const child of sidebarRootNode.children) {
        if (child.type === "section") {
            // For a section in root...
            const section = {
                ...child,
                sectionPath: [
                    ...rootSectionPath,
                    {
                        id: child.id,
                        type: child.type,
                        title: child.title
                    }
                ]
            };
            // ... push section, and all descendant sections recursively
            result.push(section, ...getAllSectionsFromSectionNode(section));
        } else if (child.type === "sidebarGroup") {
            const groupSectionPath: SectionAncestorMetadata[] = [
                ...rootSectionPath,
                {
                    id: child.id,
                    type: child.type,
                    title: null
                }
            ];
            // For a sidebar group in root, find children that are sections...
            const sections = child.children
                .filter((child) => child.type === "section")
                .map((child) => ({
                    ...child,
                    sectionPath: [
                        ...groupSectionPath,
                        {
                            id: child.id,
                            type: child.type,
                            title: child.title
                        }
                    ]
                }));
            // ... push those sections, and all descendant sections recursively
            result.push(...sections, ...sections.flatMap((section) => getAllSectionsFromSectionNode(section)));
        }
    }
    return result;
}

// PAGES
// ----------------------------------------------------------------------------

/** Resolves server page data, hydrating from registry or regenerating from MDX */
export function resolveServerPageData(
    snapshot: NavigationSnapshot,
    deps: ServerPageDataDependencies
): ResolvedPageData {
    const filename = deps.filename;
    let resolvedMdx = deps.initialMdx;

    if (deps.initialFoundNode.node.type !== "page") {
        throw new Error(
            `Could not resolve server page data, node type is not "page": "${deps.initialFoundNode.node.type}"`
        );
    }

    if (deps.initialFoundNode.node.pageId !== deps.filename) {
        throw new Error(
            `Could not resolve server page data, page IDs do not match: "${deps.filename}" !== "${deps.initialFoundNode.node.pageId}"`
        );
    }

    // Hydrate server page data from registry if data is available
    const serverEntry = Object.values(snapshot.pageRegistry).find(
        (entry) => entry.pageData.source === "server" && entry.pageData.filename === deps.filename
    );
    resolvedMdx = serverEntry?.pageData.mdx ?? resolvedMdx;
    let resolvedFrontmatter = serverEntry?.pageData.frontmatter ?? null;
    let resolvedHtml = serverEntry?.pageData.html;
    const resolvedFoundNode = serverEntry?.pageData.foundNode ?? deps.initialFoundNode;

    // If html is not available, regenerate html and frontmatter from mdx
    if (!resolvedHtml) {
        const result = mdxToHtml(resolvedMdx);
        resolvedFrontmatter = result.frontmatter;
        resolvedHtml = result.html;
    }

    return {
        source: "server",
        filename: filename,
        mdx: resolvedMdx,
        frontmatter: resolvedFrontmatter,
        html: resolvedHtml,
        foundNode: resolvedFoundNode
    };
}

/** Resolves client page data from registry (must already exist) */
export function resolveClientPageData(
    snapshot: NavigationSnapshot,
    deps: ClientPageDataDependencies
): ResolvedPageData {
    const filename = deps.filename;

    // Hydrate client page data from registry
    const clientEntry = Object.values(snapshot.pageRegistry).find(
        (entry) => entry.pageData.source === "client" && entry.pageData.filename === deps.filename
    );

    // To resolve client page data, we need to already know about it (this is different from server pages)
    if (!clientEntry) {
        throw new Error(`Could not resolve client page data, entry not found: "${deps.filename}"`);
    }

    // If mdx is not available, resolve empty defaults
    const resolvedMdx = clientEntry?.pageData.mdx;
    const resolvedFrontmatter = clientEntry?.pageData.frontmatter;
    const resolvedHtml = clientEntry?.pageData.html;
    const resolvedFoundNode = clientEntry?.pageData.foundNode;

    return {
        source: "client",
        filename: filename,
        mdx: resolvedMdx,
        html: resolvedHtml,
        frontmatter: resolvedFrontmatter,
        foundNode: resolvedFoundNode
    };
}

/** Resolves page data based on the source of the page (server or client) */
export function resolvePageData(snapshot: NavigationSnapshot, deps: PageDataDependencies): ResolvedPageData {
    return deps.source === "server" ? resolveServerPageData(snapshot, deps) : resolveClientPageData(snapshot, deps);
}

/** Converts page slug to standard client page filename format */
export function getClientPageDefaultFilename(slug: string): string {
    return `docs/pages/${slug}.mdx`;
}

// MDX
// ----------------------------------------------------------------------------

/** Generates MDX frontmatter block from configuration */
export function createMdxFrontmatter(config: { title?: string; slug?: string; subtitle?: string }): string {
    const lines = [];
    if (config.title) lines.push(`title: ${config.title}`);
    if (config.subtitle) lines.push(`subtitle: ${config.subtitle}`);
    if (config.slug) lines.push(`slug: ${config.slug}`);
    return `---\n${lines.join("\n")}\n---\n\n`;
}
