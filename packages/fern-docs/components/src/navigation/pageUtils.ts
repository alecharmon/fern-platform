import * as FernNavigation from "@fern-api/fdr-sdk/navigation";
import { mdxToHtml } from "@fern-docs/mdx";

import type {
    ClientPageDataDependencies,
    DocsYmlFilePath,
    NavigationSlug,
    NavigationSnapshot,
    PageContainerWithTraversalContext,
    PageDataDependencies,
    ResolvedPageData,
    RootLevelContainerWithTraversalContext,
    SectionAncestorMetadata,
    SectionNodeWithTraversalContext,
    ServerPageDataDependencies
} from "./types";

// ROOT NODE NAVIGATION
// ----------------------------------------------------------------------------

/**
 * Extracts the live sidebar node for the current tab from a RootNode.
 * This is useful for getting updated section information after client-side changes (e.g., renames).
 *
 * @param rootNode - The live RootNode from NavigationStore
 * @param currentTabSlug - The slug of the current tab (if using tabbed navigation)
 * @returns The SidebarRootNode for the current context, or undefined if not found
 */
export function extractLiveSidebarFromRootNode(
    rootNode: FernNavigation.RootNode | undefined,
    currentTabSlug?: string
): FernNavigation.SidebarRootNode | undefined {
    if (!rootNode) {
        return undefined;
    }

    let node: FernNavigation.NavigationNode = rootNode.child;

    // Unwrap unversioned node
    if (node.type === "unversioned") {
        node = node.child;
    } else if (node.type === "versioned") {
        // For versioned navigation, we'd need to find the right version
        // For now, return undefined to fall back to baseFoundNode
        return undefined;
    }

    // Handle tabbed vs non-tabbed navigation
    if (node.type === "tabbed") {
        if (!currentTabSlug) {
            return undefined;
        }
        // Find the tab matching the current tab slug
        const tab = node.children.find((child) => child.type === "tab" && child.slug === currentTabSlug);
        if (tab && tab.type === "tab") {
            return tab.child;
        }
        return undefined;
    } else if (node.type === "sidebarRoot") {
        // Non-tabbed navigation
        return node;
    }

    return undefined;
}

/**
 * Extracts the docs.yml file path from navigation context.
 * For multi-version docs, this determines which version file the navigation belongs to.
 * For multi-product docs, this determines which product file the navigation belongs to
 *
 * @param context - The minimal navigation context needed for file path resolution
 * @param slugToDocsYmlFilePath - Mapping of slugs to yml file paths
 * @returns The file path for the docs.yml file (e.g., "docs.yml", "versions/v2.yml")
 */
export function extractDocsYmlFilePathFromFoundNode(
    context: {
        currentVersion?: FernNavigation.VersionNode;
        currentProduct?: FernNavigation.ProductNode | FernNavigation.InternalProductNode;
        currentTab?: { slug: string };
    },
    slugToDocsYmlFilePath?: Map<NavigationSlug, DocsYmlFilePath>
): DocsYmlFilePath {
    // If no mapping is provided or it's not a Map, default to "docs.yml"
    if (!slugToDocsYmlFilePath || !(slugToDocsYmlFilePath instanceof Map) || slugToDocsYmlFilePath.size === 0) {
        console.warn(
            "[extractDocsYmlFilePathFromFoundNode] Invalid or empty slugToDocsYmlFilePath. " +
                "This usually means docsYmlBaseContent wasn't loaded yet. " +
                "Context:",
            {
                slugToDocsYmlFilePath,
                isMap: slugToDocsYmlFilePath instanceof Map,
                size: slugToDocsYmlFilePath instanceof Map ? slugToDocsYmlFilePath.size : "N/A",
                hasCurrentVersion: !!context.currentVersion,
                hasCurrentProduct: !!context.currentProduct,
                hasCurrentTab: !!context.currentTab,
                currentVersionSlug: context.currentVersion?.slug,
                currentProductSlug:
                    context.currentProduct && FernNavigation.isInternalProductNode(context.currentProduct)
                        ? context.currentProduct.slug
                        : undefined,
                currentTabSlug: context.currentTab?.slug
            }
        );
        return "docs.yml";
    }

    // Check if we're in a versioned or tabbed context
    // Priority: currentVersion > currentProduct > currentTab
    // When both product and version exist, version takes precedence (products with nested versions)

    // 1. Check for version context (most common for multi-file docs, including nested versions in products)
    if (context.currentVersion) {
        const versionSlug = context.currentVersion.slug;
        let filePath = slugToDocsYmlFilePath.get(versionSlug);

        // If exact match not found and slug contains slashes, try the last segment
        // e.g., "platform/v-2" -> try "v-2" and "v2"
        if (!filePath && versionSlug.includes("/")) {
            const lastSegment = versionSlug.split("/").pop();
            if (lastSegment) {
                filePath = slugToDocsYmlFilePath.get(lastSegment);

                // Also try with underscores replaced by hyphens or vice versa
                if (!filePath) {
                    const normalized = lastSegment.replace(/-/g, "");
                    filePath = slugToDocsYmlFilePath.get(normalized);
                }
            }
        }

        if (filePath) {
            return filePath;
        }

        // If version slug not found, it might actually be a product slug
        // (this happens when FDR provides a FoundNode with currentVersion pointing to a product)
        // Try falling through to product check instead of warning here
    }

    // 2. Check for product context (for multi-product docs)
    // Only internal products have slug property; external products link to external URLs
    if (context.currentProduct && FernNavigation.isInternalProductNode(context.currentProduct)) {
        const productSlug = context.currentProduct.slug;

        // Try exact match first
        let filePath = slugToDocsYmlFilePath.get(productSlug);
        if (filePath) {
            return filePath;
        }

        // If the slug contains a slash (e.g., "learn/docs"), try the last segment
        if (productSlug.includes("/")) {
            const lastSegment = productSlug.split("/").pop();
            if (lastSegment) {
                filePath = slugToDocsYmlFilePath.get(lastSegment);
                if (filePath) {
                    return filePath;
                }
            }
        }

        console.warn(
            `[extractDocsYmlFilePathFromFoundNode] No file path found for product slug: "${productSlug}". Available slugs:`,
            Array.from(slugToDocsYmlFilePath.keys())
        );
    }

    // 3. Check for tab context (for tabbed docs with file references)
    if (context.currentTab) {
        const tabSlug = context.currentTab.slug;
        const filePath = slugToDocsYmlFilePath.get(tabSlug);
        if (filePath) {
            return filePath;
        }
    }

    // Default to main docs.yml if no match found
    console.warn(
        "[extractDocsYmlFilePathFromFoundNode] Could not determine file path from context, defaulting to docs.yml. Context:",
        {
            hasCurrentVersion: !!context.currentVersion,
            hasCurrentProduct: !!context.currentProduct,
            hasCurrentTab: !!context.currentTab,
            availableSlugs: Array.from(slugToDocsYmlFilePath.keys())
        }
    );
    return "docs.yml";
}

// SECTIONS
// ----------------------------------------------------------------------------

/** Gets a flat list of all sections from a section node */
function getAllSectionsFromSectionNode(
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
                        id: child.id,
                        type: child.type,
                        title: child.title
                    }
                ]
            };
            result.push(section, ...getAllSectionsFromSectionNode(section));
        }
    }
    return result;
}

/** Gets a flat list of all sections from a sidebar root node */
function getAllSectionsFromSidebarRootNode(
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

/**
 * Gets a flat list of all containers (sections + root-level containers) that can hold pages
 * @param sidebarRootNode - The sidebar root node
 * @param currentTabSlug - The slug of the current tab (used for root-level container slugs)
 * @returns Array of both sections and root-level containers that can contain pages
 */
export function getAllPageContainersFromSidebarRootNode(
    sidebarRootNode: FernNavigation.SidebarRootNode,
    currentTabSlug?: string
): PageContainerWithTraversalContext[] {
    const result: PageContainerWithTraversalContext[] = [];

    // First, get all sections using the existing function
    const sections = getAllSectionsFromSidebarRootNode(sidebarRootNode);
    result.push(...sections);

    // Add exactly one root-level container representing "No section".
    // Always target the sidebarRoot — insertNodeIntoParent auto-wraps pages in
    // a SidebarGroupNode when they can't be direct sidebarRoot children.
    //
    // Flatten sidebarGroup children so that duplicate slug validation can find
    // page nodes that live inside sidebarGroups (sidebarGroups are invisible wrappers).
    const flatChildren: FernNavigation.NavigationNode[] = [];
    for (const child of sidebarRootNode.children) {
        if (child.type === "sidebarGroup") {
            flatChildren.push(...child.children);
        } else {
            flatChildren.push(child);
        }
    }

    const rootContainer: RootLevelContainerWithTraversalContext = {
        type: "sidebarRoot",
        id: sidebarRootNode.id,
        title: null,
        slug: currentTabSlug || "",
        sectionPath: [
            {
                id: sidebarRootNode.id,
                type: sidebarRootNode.type,
                title: null
            }
        ],
        isRootLevel: true,
        children: flatChildren
    };
    result.push(rootContainer);

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

    // Hydrate server page data from registry if data is available
    const serverEntry = Object.values(snapshot.pageRegistry).find(
        (entry) => entry.pageData.source === "server" && entry.pageData.filename === deps.filename
    );
    resolvedMdx = serverEntry?.pageData.mdx ?? resolvedMdx;
    let resolvedFrontmatter = serverEntry?.pageData.frontmatter ?? null;
    let resolvedHtml = serverEntry?.pageData.html;
    const resolvedFoundNode = serverEntry?.pageData.foundNode ?? deps.initialFoundNode;

    // If html is not available, regenerate html and frontmatter from mdx
    let resolvedBulletStyle = serverEntry?.pageData.bulletStyle;
    let resolvedOriginalFrontmatter = serverEntry?.pageData.originalFrontmatter;
    if (!resolvedHtml) {
        const result = mdxToHtml(resolvedMdx);
        resolvedFrontmatter = result.frontmatter;
        resolvedHtml = result.html;
        resolvedBulletStyle = result.bulletStyle;
        resolvedOriginalFrontmatter = result.originalFrontmatter;
    }

    return {
        source: "server",
        filename: filename,
        mdx: resolvedMdx,
        frontmatter: resolvedFrontmatter,
        html: resolvedHtml,
        foundNode: resolvedFoundNode,
        bulletStyle: resolvedBulletStyle,
        originalFrontmatter: resolvedOriginalFrontmatter
    };
}

/** Resolves client page data from registry (must already exist) */
export function resolveClientPageData(
    snapshot: NavigationSnapshot,
    deps: ClientPageDataDependencies
): ResolvedPageData {
    // Hydrate client page data from registry.
    // Use case-insensitive comparison because the server derives the filename from
    // the lowercase slug (e.g. "docs/pages/agent-studio/page.mdx") while the creation
    // side may use casing-corrected paths from the filesystem (e.g. "docs/pages/My-Section/page.mdx").
    const depsFilenameLower = deps.filename.toLowerCase();
    let clientEntry = Object.values(snapshot.pageRegistry).find(
        (entry) => entry.pageData.source === "client" && entry.pageData.filename.toLowerCase() === depsFilenameLower
    );

    // Fallback: match by slug when filename doesn't match.
    // The server always generates filenames as "docs/pages/{slug}.mdx", but the actual
    // file path may be different (e.g. "docs/guides/test.mdx" for a folder at docs/guides/).
    // Extract the slug from the server-generated filename and match against the page node's slug.
    if (!clientEntry && deps.filename.startsWith("docs/pages/") && deps.filename.endsWith(".mdx")) {
        const slugFromFilename = deps.filename.slice("docs/pages/".length, -".mdx".length);
        clientEntry = Object.values(snapshot.pageRegistry).find(
            (entry) =>
                entry.pageData.source === "client" &&
                "slug" in entry.pageData.foundNode.node &&
                entry.pageData.foundNode.node.slug === slugFromFilename
        );
    }

    // To resolve client page data, we need to already know about it (this is different from server pages)
    if (!clientEntry) {
        throw new Error(`Could not resolve client page data, entry not found: "${deps.filename}"`);
    }

    // If mdx is not available, resolve empty defaults
    const resolvedMdx = clientEntry?.pageData.mdx;
    const resolvedFrontmatter = clientEntry?.pageData.frontmatter;
    const resolvedHtml = clientEntry?.pageData.html;
    const resolvedFoundNode = clientEntry?.pageData.foundNode;

    // Use the registry's filename (with correct casing) rather than the slug-derived one.
    // This ensures subsequent edits use the same casing-corrected path as the initial creation,
    // preventing duplicate files (e.g. "My-Section/test.mdx" vs "my-section/test.mdx").
    const resolvedFilename = clientEntry.pageData.filename;

    return {
        source: "client",
        filename: resolvedFilename,
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

/**
 * Converts page slug to a client page filename.
 *
 * When a directoryPrefix is provided (extracted from existing sibling pages),
 * the file is placed directly in that directory using only the last segment
 * of the slug as the filename. This handles both casing preservation
 * (e.g., "My-Section" instead of "my-section") and non-standard paths
 * (e.g., "docs/guides" instead of "docs/pages/...").
 *
 * Without a directoryPrefix, falls back to the standard `docs/pages/{slug}.mdx` format.
 *
 * @param slug - The page slug (lowercased, used for URL and fallback path)
 * @param directoryPrefix - Optional directory prefix with original casing from sibling pages
 */
export function getClientPageDefaultFilename(slug: string, directoryPrefix?: string): string {
    if (directoryPrefix) {
        // Use the provided directory prefix (with original casing) and only the last
        // segment of the slug as the filename. The full slug is for URLs, not file paths.
        const slugSegments = slug.split("/");
        const pageSlug = slugSegments[slugSegments.length - 1] || slug;
        // Ensure prefix doesn't have trailing slash
        const normalizedPrefix = directoryPrefix.replace(/\/+$/, "");
        return `${normalizedPrefix}/${pageSlug}.mdx`;
    }
    return `docs/pages/${slug}.mdx`;
}

/**
 * Extracts the directory prefix from existing sibling page filenames in a container.
 * This preserves the original directory casing from the filesystem.
 *
 * For example, if a section contains a page with pageId "docs/pages/My-Section/overview.mdx",
 * this function returns "docs/pages/My-Section" — preserving the original casing.
 *
 * @param container - The page container (section or root-level) to extract directory from
 * @returns The directory prefix with original casing, or undefined if no sibling pages found
 */
export function extractDirectoryFromSiblingPages(container: PageContainerWithTraversalContext): string | undefined {
    // Get children from the container
    const children: readonly FernNavigation.NavigationNode[] = "children" in container ? container.children : [];

    // Look for existing page nodes to extract their directory prefix
    for (const child of children) {
        if (child.type === "page" && "pageId" in child) {
            const pageId = String(child.pageId);
            // Extract directory from the pageId (filename), e.g.:
            // "docs/pages/My-Section/overview.mdx" -> "docs/pages/My-Section"
            const lastSlash = pageId.lastIndexOf("/");
            if (lastSlash > 0) {
                return pageId.substring(0, lastSlash);
            }
        }
    }
    return undefined;
}

// MDX
// ----------------------------------------------------------------------------

/** Generates MDX frontmatter block from configuration */
export function createMdxFrontmatter(config: { title?: string; slug?: string; subtitle?: string }): string {
    const lines = [];
    if (config.title) {
        lines.push(`title: ${config.title}`);
    }
    if (config.subtitle) {
        lines.push(`subtitle: ${config.subtitle}`);
    }
    if (config.slug) {
        lines.push(`slug: ${config.slug}`);
    }
    return `---\n${lines.join("\n")}\n---\n\n`;
}
