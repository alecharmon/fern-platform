/**
 * Base/shared renderer utilities.
 */

export { renderDocstring, renderSimpleDocstring } from "./DocstringRenderer.js";
export type { NavigationItem, NavigationPage, NavigationSection, RenderedOutput } from "./types.js";
export {
    createFrontmatter,
    escapeMdx,
    escapeTableCell,
    formatTypeAnnotation,
    generateAnchorId,
    indent,
    joinLines
} from "./utils.js";
