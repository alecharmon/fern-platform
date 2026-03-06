import type { Slug } from ".";
import type { NavigationNode } from "./NavigationNode";

/**
 * A navigation node that has a slug.
 */
export type NavigationNodeWithSlug = Extract<NavigationNode, { slug: Slug }>;

export function hasSlug(node: NavigationNode): node is NavigationNodeWithSlug {
    return typeof (node as NavigationNodeWithSlug).slug === "string";
}
