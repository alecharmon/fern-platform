/**
 * List of MDX component names that should be rendered inline within paragraphs
 * rather than as block-level elements.
 *
 * Components in this list will be rendered as custom-inline-element-v2 nodes
 * in the Tiptap editor, allowing them to appear within text content.
 */
export const INLINE_COMPONENT_ALLOWLIST: ReadonlySet<string> = new Set<string>(["Icon"]);

/**
 * Check if a component name should be rendered inline
 */
export function isInlineComponent(componentName: string | undefined): boolean {
    return componentName != null && INLINE_COMPONENT_ALLOWLIST.has(componentName);
}
