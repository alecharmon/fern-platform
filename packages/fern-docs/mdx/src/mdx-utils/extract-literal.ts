import type { Program } from "estree";
import { walk } from "estree-walker";
import type { MdxJsxAttributeValueExpression } from "mdast-util-mdx-jsx";

type Literal = string | number | bigint | boolean | RegExp | null | undefined;

/**
 * Extracts a single literal from an estree program.
 *
 * @param estree - The estree program to extract the literal from.
 * @returns The literal if there is exactly one, otherwise `undefined`.
 * If the estree contains JSX elements, extracts and concatenates all text content.
 */
export function extractSingleLiteral(estree?: Program | null | undefined): Literal {
    if (estree == null) {
        return undefined;
    }
    const literals: Literal[] = [];
    const textParts: string[] = [];
    let hasJsxContent = false;

    walk(estree, {
        enter: function (node) {
            // ignore function declarations and arrow functions
            if (node.type === "FunctionDeclaration" || node.type === "ArrowFunctionExpression") {
                this.skip();
            }

            // Track that we have JSX content
            if (
                node.type === "JSXElement" ||
                node.type === "JSXFragment" ||
                node.type === "JSXOpeningElement" ||
                node.type === "JSXOpeningFragment"
            ) {
                hasJsxContent = true;
            }

            // Extract text from JSX text nodes
            if (node.type === "JSXText") {
                textParts.push(node.value);
            }

            // Extract literals from JSX expression containers
            if (node.type === "JSXExpressionContainer" && node.expression.type === "Literal") {
                if (typeof node.expression.value === "string") {
                    textParts.push(node.expression.value);
                }
            }

            if (node.type === "Literal") {
                literals.push(node.value);
            }
        }
    });

    // If we found JSX content and extracted text, return the concatenated text
    if (hasJsxContent && textParts.length > 0) {
        return textParts.join("").trim();
    }

    // Otherwise, return single literal if found
    return literals.length === 1 ? literals[0] : undefined;
}

/**
 * Extracts an array literal from an estree program.
 *
 * @param estree - The estree program to extract the array from.
 * @returns The array if it's a simple array of literals, otherwise `undefined`.
 */
export function extractArrayLiteral(estree?: Program | null | undefined): Literal[] | undefined {
    if (estree == null) {
        return undefined;
    }

    let arrayElements: Literal[] | undefined;
    let hasNonLiteral = false;

    walk(estree, {
        enter: function (node) {
            // ignore function declarations, arrow functions, and JSX elements
            if (
                node.type === "FunctionDeclaration" ||
                node.type === "ArrowFunctionExpression" ||
                node.type === "JSXOpeningElement" ||
                node.type === "JSXOpeningFragment"
            ) {
                this.skip();
            }

            if (node.type === "ArrayExpression") {
                const elements: Literal[] = [];
                for (const element of node.elements) {
                    if (element?.type === "Literal") {
                        elements.push(element.value);
                    } else {
                        hasNonLiteral = true;
                        return;
                    }
                }
                if (!hasNonLiteral) {
                    arrayElements = elements;
                }
            }
        }
    });

    return hasNonLiteral ? undefined : arrayElements;
}

/**
 * Works for:
 *  - <Component prop="a" />
 *  - <Component prop={1} />
 *  - <Component prop={"a"} />
 *  - <Component prop={`a`} />
 *  - <Component prop={["a"]} />
 *
 * Does not work for:
 *  - <Component prop={() => {}} />
 *  - <Component prop={something("else")} />
 *  - <Component prop={["a", "b"]} />
 *  - <Component prop={<div />} />
 */
export function extractAttributeValueLiteral(
    value: string | MdxJsxAttributeValueExpression | null | undefined
): Literal | undefined {
    if (typeof value === "string") {
        return value;
    }

    if (value?.type === "mdxJsxAttributeValueExpression") {
        return extractSingleLiteral(value.data?.estree);
    }

    return undefined;
}

/**
 * Works for:
 *  - <Component prop={["a"]} />
 *  - <Component prop={["a", "b"]} />
 *  - <Component prop={[1, 2, 3]} />
 *
 * Does not work for:
 *  - <Component prop={["a", someVariable]} />
 *  - <Component prop={[() => {}]} />
 *  - <Component prop={<div />} />
 */
export function extractAttributeArrayLiteral(
    value: string | MdxJsxAttributeValueExpression | null | undefined
): Literal[] | undefined {
    if (typeof value === "string") {
        return undefined;
    }

    if (value?.type === "mdxJsxAttributeValueExpression") {
        return extractArrayLiteral(value.data?.estree);
    }

    return undefined;
}
