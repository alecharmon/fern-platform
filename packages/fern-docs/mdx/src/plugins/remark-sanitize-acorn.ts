import type { Program } from "estree";
import { walk } from "estree-walker";
import type { Root } from "mdast";
import { SKIP, visit } from "unist-util-visit";

import type { Unified } from "../unified";

interface Options {
    /**
     * This is the global scope of identifiers that are allowed to be consumed by acorn.
     */
    allowedIdentifiers?: string[];
}

/**
 * Not allowed: Promise, crypto, etc.
 *
 * Note: `props` will be used by @mdx-js/esbuild
 * and `frontmatter` is injected by @mdx-js/mdx
 */
const ALLOWED_GLOBAL_IDENTIFIERS: string[] = [
    "Math",
    "Date",
    "RegExp",
    "JSON",
    "Set",
    "Map",
    "URL",
    "props",
    "frontmatter"
];

/**
 * This plugin makes a best effort to strip away any acorn expressions that are not valid.
 *
 * - some global elements are allowed, such as Math, Date, JSON, etc.
 * - await expressions are not allowed, and will be escaped.
 */
export const remarkSanitizeAcorn: Unified.Plugin<[Options?], Root> = ({ allowedIdentifiers = [] } = {}) => {
    return (tree) => {
        const allowedIdentifiersSet = new Set([...ALLOWED_GLOBAL_IDENTIFIERS, ...allowedIdentifiers]);

        // add identifiers from ESM to the allowed identifiers set
        // i.e. `export const foo = 1;` should avoid escaping `foo`.
        visit(tree, (node, index, parent) => {
            if (node.type === "mdxjsEsm") {
                const { identifiers, jsxIdentifiers, isAwaited } = collectIdentifiers(node.data?.estree);
                if (isAwaited && parent && index != null) {
                    // escape the expression if it contains identifiers that are not allowed:
                    parent.children[index] = {
                        type: "text",
                        value: `{${node.value}}`
                    };
                    return SKIP;
                }
                identifiers.forEach((id) => allowedIdentifiersSet.add(id));
                jsxIdentifiers.forEach((id) => allowedIdentifiersSet.add(id));
            }
            return;
        });

        // HACK: attempt to extract identifiers that are in-use via JSX attributes.
        // if any identifiers are present in JSX attributes, add them to the allowed identifiers set
        // so that they're not escaped within acorns.
        visit(tree, (node) => {
            if (node.type === "mdxJsxFlowElement" || node.type === "mdxJsxTextElement") {
                if (node.name) {
                    allowedIdentifiersSet.add(node.name);
                }

                node.attributes.forEach((attr) => {
                    if (attr.type === "mdxJsxAttribute" && attr.value && typeof attr.value !== "string") {
                        const { identifiers, jsxIdentifiers } = collectIdentifiers(attr.value.data?.estree);
                        identifiers.forEach((id) => allowedIdentifiersSet.add(id));
                        jsxIdentifiers.forEach((id) => allowedIdentifiersSet.add(id));
                    }
                });
            }
        });

        visit(tree, (node, index, parent) => {
            if (node.type === "mdxTextExpression" || node.type === "mdxFlowExpression") {
                const { identifiers, isAwaited, hasNonRenderableExpression } = collectIdentifiers(node.data?.estree);
                if (
                    identifiers.every((identifier) => allowedIdentifiersSet.has(identifier)) &&
                    !isAwaited &&
                    !hasNonRenderableExpression
                ) {
                    // continue if all identifiers are allowed, the expression is not awaited,
                    // and it doesn't contain non-renderable expressions (object/array literals).
                    return;
                } else if (parent && index != null) {
                    // escape the expression if it contains identifiers that are not allowed:
                    parent.children[index] = {
                        type: "text",
                        value: `{${node.value}}`
                    };
                    return SKIP;
                }
            }

            return;
        });
    };
};

function collectIdentifiers(estree: Program | null | undefined): {
    identifiers: string[];
    jsxIdentifiers: string[];
    isAwaited: boolean;
    hasNonRenderableExpression: boolean;
} {
    if (!estree) {
        return { identifiers: [], jsxIdentifiers: [], isAwaited: false, hasNonRenderableExpression: false };
    }

    let isAwaited = false;
    const identifiers = new Set<string>();
    const jsxIdentifiers = new Set<string>();

    // Detect object/array literals at the top level of the expression.
    // These are not valid React children and will cause runtime errors like:
    // "Objects are not valid as a React child (found: object with keys {})"
    const hasNonRenderableExpression = checkForNonRenderableExpression(estree);

    walk(estree, {
        enter(node) {
            if (node.type === "AwaitExpression") {
                isAwaited = true;
                this.skip();
                return;
            }
        }
    });

    if (isAwaited) {
        return { identifiers: [], jsxIdentifiers: [], isAwaited, hasNonRenderableExpression };
    }

    // collect identifiers that can cause acorn evaluation to fail
    walk(estree, {
        enter(node) {
            if (node.data?._mdxSkipSanitization) {
                this.skip();
                return;
            }

            if (node.type === "Property") {
                (node.key.data ??= {})._mdxSkipSanitization = true;
                return;
            }

            if (node.type === "MemberExpression") {
                (node.property.data ??= {})._mdxSkipSanitization = true;
                return;
            }

            // ignore contents of arrow functions (we only care about global identifiers)
            if (node.type === "ArrowFunctionExpression") {
                this.skip();
                return;
            }

            // TODO: should we really be collecting all identifiers?
            if (node.type === "Identifier") {
                identifiers.add(node.name);
            }

            if (node.type === "JSXIdentifier") {
                jsxIdentifiers.add(node.name);
            }
        }
    });

    return {
        identifiers: Array.from(identifiers),
        jsxIdentifiers: Array.from(jsxIdentifiers),
        isAwaited,
        hasNonRenderableExpression
    };
}

/**
 * Checks if the estree program contains a top-level expression that evaluates to
 * an object or array literal, which are not valid React children.
 * e.g. `{{}}` produces an ExpressionStatement with an ObjectExpression,
 * and `{[]}` produces an ExpressionStatement with an ArrayExpression.
 */
function checkForNonRenderableExpression(estree: Program): boolean {
    for (const node of estree.body) {
        if (node.type === "ExpressionStatement") {
            const expr = node.expression;
            if (expr.type === "ObjectExpression" || expr.type === "ArrayExpression") {
                return true;
            }
        }
    }
    return false;
}
