/**
 * Wraps the React JSX runtime to prevent invalid HTML nesting that causes
 * hydration errors. Specifically, converts <p> elements that contain
 * block-level children (e.g. <div>) to <div> elements at runtime.
 *
 * This is needed because compiled MDX content may contain raw JSX like
 * jsxs("p", { children: [jsx("div", ...)] }) which bypasses MDXProvider
 * component mappings. The browser auto-closes <p> when it encounters
 * block-level elements, creating a DOM mismatch (React hydration error #418).
 */

import type { ReactElement, ReactNode } from "react";

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

function hasBlockLevelChild(children: ReactNode): boolean {
    if (children == null || typeof children !== "object") {
        return false;
    }

    if (Array.isArray(children)) {
        return children.some(hasBlockLevelChild);
    }

    // Check if child is a React element with a block-level tag
    const element = children as ReactElement;
    if (element.type && typeof element.type === "string" && BLOCK_LEVEL_TAGS.has(element.type)) {
        return true;
    }

    return false;
}

/**
 * Wraps a JSX runtime so that <p> elements containing block-level children
 * are rendered as <div> instead, preventing hydration mismatches.
 */
export function safeParagraphJsxRuntime<T extends Record<string, any>>(runtime: T): T {
    const originalJsx = runtime.jsx;
    const originalJsxs = runtime.jsxs;

    return {
        ...runtime,
        jsx: (type: string | React.ComponentType, props: { children?: ReactNode }, key?: string) => {
            if (type === "p" && props.children != null && hasBlockLevelChild(props.children)) {
                return originalJsx("div", props, key);
            }
            return originalJsx(type, props, key);
        },
        jsxs: (type: string | React.ComponentType, props: { children?: ReactNode }, key?: string) => {
            if (type === "p" && props.children != null && hasBlockLevelChild(props.children)) {
                return originalJsxs("div", props, key);
            }
            return originalJsxs(type, props, key);
        }
    };
}
