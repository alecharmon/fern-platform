import type { Hast } from "@fern-docs/mdx";
import parseNumericRange from "parse-numeric-range";

/**
 * Expands range syntax in the `highlight` attribute of MDX JSX elements.
 * For example, `highlight={[1-5, 7, 9]}` becomes `highlight={[1, 2, 3, 4, 5, 7, 9]}`.
 *
 * This is necessary because JSX expressions like `[1-5, 7, 9]` would normally be
 * evaluated as JavaScript where `1-5` becomes `-4`. This function intercepts the
 * raw expression string before JavaScript evaluation and rewrites it.
 */
export function expandHighlightRanges(node: Hast.MdxJsxElement): void {
    for (const attr of node.attributes) {
        if (attr.type !== "mdxJsxAttribute" || attr.name !== "highlight") {
            continue;
        }

        if (typeof attr.value === "object" && attr.value?.type === "mdxJsxAttributeValueExpression") {
            const rawExpr = attr.value.value;
            if (/\[\s*[\d\s,-]+\s*\]/.test(rawExpr) && rawExpr.includes("-")) {
                const expanded = parseNumericRange(rawExpr.replace(/[[\]]/g, ""));
                attr.value = {
                    type: "mdxJsxAttributeValueExpression",
                    value: `[${expanded.join(", ")}]`,
                    data: {
                        estree: {
                            type: "Program",
                            body: [
                                {
                                    type: "ExpressionStatement",
                                    expression: {
                                        type: "ArrayExpression",
                                        elements: expanded.map((n) => ({
                                            type: "Literal",
                                            value: n,
                                            raw: String(n)
                                        }))
                                    }
                                }
                            ],
                            sourceType: "module"
                        }
                    }
                };
            }
        }
    }
}
