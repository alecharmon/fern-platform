import type { Doctype, Element, ElementContent, Root } from "hast";
import type { MdxjsEsmHast } from "mdast-util-mdxjs-esm";
import type { Plugin } from "unified";
import { SKIP, visit } from "unist-util-visit";

import { isMdxJsxElementHast } from "../mdx-utils/is-mdx-element";

function isParagraphElement(node: ElementContent | Root | Doctype | MdxjsEsmHast): node is Element {
    return (node.type === "element" && node.tagName === "p") || (isMdxJsxElementHast(node) && node.name === "p");
}

// Block-level elements that are not valid inside <p> per HTML spec.
// When the browser encounters these inside a <p>, it auto-closes the <p>,
// creating a DOM structure different from what React expects (hydration error #418).
const BLOCK_LEVEL_TAGS = new Set([
    "address",
    "article",
    "aside",
    "blockquote",
    "details",
    "dialog",
    "dd",
    "div",
    "dl",
    "dt",
    "fieldset",
    "figcaption",
    "figure",
    "footer",
    "form",
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "header",
    "hgroup",
    "hr",
    "li",
    "main",
    "nav",
    "ol",
    "p",
    "pre",
    "section",
    "table",
    "ul"
]);

function containsBlockLevelChild(node: Element): boolean {
    return node.children.some(
        (child) =>
            (child.type === "element" && BLOCK_LEVEL_TAGS.has(child.tagName)) ||
            (isMdxJsxElementHast(child) && child.name != null && BLOCK_LEVEL_TAGS.has(child.name.toLowerCase()))
    );
}

/**
 * Removes <p> tags that are nested inside <p> tags.
 * Also converts <p> tags that contain block-level children (e.g. <div>) to <div>,
 * preventing invalid HTML nesting that causes React hydration errors.
 */
export const rehypeSqueezeParagraphs: Plugin<[{ stripParagraph?: boolean }?], Root> = ({
    stripParagraph = false
} = {}) => {
    return (ast: Root): void => {
        visit(ast, (node, index, parent) => {
            if (index == null || parent == null) {
                return;
            }
            if (isParagraphElement(node) && (isParagraphElement(parent) || stripParagraph)) {
                parent.children.splice(index, 1, ...node.children);
                return [SKIP, index];
            }
            // Convert <p> containing block-level children to <div> to avoid invalid nesting
            if (node.type === "element" && node.tagName === "p" && containsBlockLevelChild(node)) {
                node.tagName = "div";
            }
            return;
        });
    };
};
