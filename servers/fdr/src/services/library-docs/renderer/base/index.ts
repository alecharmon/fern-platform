/**
 * Base/shared renderer utilities.
 */

export { renderDocstring, renderSimpleDocstring } from "./DocstringRenderer.js";
export type { NavNode, NavPageNode, NavSectionNode, RenderedOutput } from "./types.js";
export {
    createFrontmatter,
    escapeMdx,
    escapeMdxForDescription,
    escapeTableCell,
    formatTypeAnnotation,
    generateAnchorId
} from "./utils.js";
