/**
 * Shared types for library docs rendering.
 */

/**
 * A navigation page entry.
 */
export interface NavigationPage {
    title: string;
    slug: string;
}

/**
 * A navigation section with nested items.
 */
export interface NavigationSection {
    title: string;
    contents: NavigationItem[];
}

/**
 * A navigation item - either a page or a section.
 */
export type NavigationItem = { type: "page"; value: NavigationPage } | { type: "section"; value: NavigationSection };

/**
 * Output from a renderer.
 */
export interface RenderedOutput {
    /** Map of page path to MDX content */
    pages: Record<string, string>;
    /** Navigation structure derived from module tree */
    navigation: NavigationItem[];
}
