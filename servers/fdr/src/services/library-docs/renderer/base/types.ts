/**
 * Shared types for library docs rendering.
 *
 * These types represent the output of language-specific renderers.
 * They contain all information needed for FDR integration without
 * coupling renderers to FDR-specific types.
 */

/**
 * A navigation node - either a page or a section.
 * Contains stable identifiers derived from module paths.
 */
export type NavNode = NavPageNode | NavSectionNode;

/**
 * A page node in the navigation tree.
 */
export interface NavPageNode {
    type: "page";
    /** Page title for display */
    title: string;
    /** Stable slug derived from module path (e.g., "library-docs/mypackage/utils") */
    slug: string;
    /** Page ID including .mdx extension (e.g., "library-docs/mypackage/utils.mdx") */
    pageId: string;
}

/**
 * A section node in the navigation tree.
 */
export interface NavSectionNode {
    type: "section";
    /** Section title for display */
    title: string;
    /** Stable slug derived from module path (e.g., "library-docs/mypackage") */
    slug: string;
    /** Child nodes (pages or nested sections) */
    children: NavNode[];
}

/**
 * Output from a renderer.
 * Pages are keyed by pageId for direct use in FDR.
 */
export interface RenderedOutput {
    /** Map of pageId to MDX content */
    pages: Record<string, string>;
    /** Navigation tree with stable slugs derived from module paths */
    navigation: NavNode[];
}
