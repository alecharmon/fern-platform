import * as csstree from "css-tree";

/**
 * List of potentially dangerous CSS functions that should be blocked
 */
const DANGEROUS_CSS_FUNCTIONS = [
    "url",
    "import",
    "expression" // IE only, but still dangerous
];

/**
 * List of dangerous CSS at-rules that should be blocked
 */
const DANGEROUS_AT_RULES = [
    "import",
    "charset" // Can be used for encoding attacks
];

/**
 * Sanitizes CSS content by removing dangerous constructs that could lead to:
 * - CSS injection attacks
 * - Data exfiltration via CSS selectors
 * - External resource loading via @import or url()
 * - Script execution via expression() (IE)
 *
 * @param css - The CSS string to sanitize
 * @returns Sanitized CSS string with dangerous constructs removed
 */
export function sanitizeCSS(css: string): string {
    if (!css || typeof css !== "string") {
        return "";
    }

    const trimmedCss = css.trim();
    if (!trimmedCss) {
        return "";
    }

    try {
        // Parse the CSS into an AST with full parsing to detect all function calls
        const ast = csstree.parse(trimmedCss, {
            parseValue: true, // Parse values to detect function calls
            parseCustomProperty: true // Parse custom properties for completeness
        });

        // Walk through the AST and mark dangerous nodes for removal
        const nodesToRemove: {
            list: csstree.List<csstree.CssNode>;
            item: csstree.ListItem<csstree.CssNode>;
        }[] = [];

        csstree.walk(
            ast,
            (node: csstree.CssNode, item: csstree.ListItem<csstree.CssNode>, list: csstree.List<csstree.CssNode>) => {
                // Mark dangerous at-rules like @import for removal
                if (node.type === "Atrule") {
                    const ruleName = node.name.toLowerCase();
                    if (DANGEROUS_AT_RULES.includes(ruleName)) {
                        if (list && item) {
                            nodesToRemove.push({ list, item });
                        }
                        return;
                    }
                }

                // Mark dangerous functions like url(), expression() for removal
                if (node.type === "Function") {
                    const functionName = node.name.toLowerCase();
                    if (DANGEROUS_CSS_FUNCTIONS.includes(functionName)) {
                        if (list && item) {
                            nodesToRemove.push({ list, item });
                        }
                        return;
                    }
                }

                // Mark any URL nodes for removal
                if (node.type === "Url") {
                    if (list && item) {
                        nodesToRemove.push({ list, item });
                    }
                    return;
                }

                // Mark declarations that contain dangerous content for removal
                if (node.type === "Declaration") {
                    // Check if the declaration contains dangerous patterns
                    const declarationText = csstree.generate(node).toLowerCase();
                    if (declarationText.includes("url(") || declarationText.includes("expression(")) {
                        if (list && item) {
                            nodesToRemove.push({ list, item });
                        }
                    }
                }

                // Mark any raw nodes that might contain dangerous content for removal
                if (node.type === "Raw" && node.value) {
                    const rawValue = node.value.toLowerCase();
                    if (rawValue.includes("url(") || rawValue.includes("@import") || rawValue.includes("expression(")) {
                        if (list && item) {
                            nodesToRemove.push({ list, item });
                        }
                        return;
                    }
                }
            }
        );

        // Remove all marked nodes
        nodesToRemove.forEach(({ list, item }) => {
            list.remove(item);
        });

        // Generate sanitized CSS from the cleaned AST
        return csstree.generate(ast);
    } catch (error) {
        // If parsing fails, return empty string for safety
        console.warn("CSS parsing failed during sanitization:", error);
        return "";
    }
}
