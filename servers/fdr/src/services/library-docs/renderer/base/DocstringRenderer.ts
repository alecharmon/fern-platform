/**
 * Render DocstringIR to MDX.
 */

import type { FdrLambda } from "@fern-api/fdr-lambda-sdk";
import { escapeMdx, formatTypeAnnotation } from "./utils.js";

/**
 * Render a docstring to MDX.
 */
export function renderDocstring(
    docstring: FdrLambda.libraryDocs.DocstringIr | null | undefined,
    paramAnnotations?: Record<string, string>,
    returnAnnotation?: string
): string {
    if (!docstring) {
        return "";
    }

    const lines: string[] = [];

    // Description (contains full text; summary is only used for tables/tooltips)
    if (docstring.description) {
        lines.push(escapeMdx(docstring.description));
        lines.push("");
    }

    // Parameters
    if (docstring.params && docstring.params.length > 0) {
        lines.push("**Parameters:**");
        lines.push("");
        for (const param of docstring.params) {
            const type = param.type || paramAnnotations?.[param.name] || "";
            const typeStr = type ? formatTypeAnnotation(type) : "";
            const attrs: string[] = [`path="${param.name}"`];
            if (typeStr) {
                attrs.push(`type="${typeStr}"`);
            }
            if (param.default) {
                attrs.push(`default="${escapeMdx(param.default)}"`);
            }

            lines.push(`<ParamField ${attrs.join(" ")}>`);
            lines.push(param.description ? escapeMdx(param.description) : "");
            lines.push("</ParamField>");
            lines.push("");
        }
    }

    // Returns
    if (docstring.returns) {
        const type = docstring.returns.type || returnAnnotation || "";
        const typeStr = type ? `\`${formatTypeAnnotation(type)}\`` : "";
        lines.push(`**Returns:** ${typeStr}`);
        lines.push("");
        if (docstring.returns.description) {
            lines.push(escapeMdx(docstring.returns.description));
            lines.push("");
        }
    }

    // Raises
    if (docstring.raises && docstring.raises.length > 0) {
        lines.push("**Raises:**");
        lines.push("");
        for (const exc of docstring.raises) {
            lines.push(`- \`${escapeMdx(exc.type)}\`${exc.description ? `: ${escapeMdx(exc.description)}` : ""}`);
        }
        lines.push("");
    }

    // Examples
    if (docstring.examples && docstring.examples.length > 0) {
        lines.push("**Examples:**");
        lines.push("");
        for (const example of docstring.examples) {
            if (example.description) {
                lines.push(escapeMdx(example.description));
                lines.push("");
            }
            lines.push("```python");
            lines.push(example.code);
            lines.push("```");
            lines.push("");
        }
    }

    // Notes
    if (docstring.notes && docstring.notes.length > 0) {
        lines.push("<Note>");
        lines.push("");
        for (const note of docstring.notes) {
            lines.push(escapeMdx(note));
        }
        lines.push("");
        lines.push("</Note>");
        lines.push("");
    }

    // Warnings
    if (docstring.warnings && docstring.warnings.length > 0) {
        lines.push("<Warning>");
        lines.push("");
        for (const warning of docstring.warnings) {
            lines.push(escapeMdx(warning));
        }
        lines.push("");
        lines.push("</Warning>");
        lines.push("");
    }

    return lines.join("\n");
}

/**
 * Render a simple docstring (just text, no structured sections).
 */
export function renderSimpleDocstring(docstring: FdrLambda.libraryDocs.DocstringIr | null | undefined): string {
    if (!docstring) {
        return "";
    }

    // Description contains full text; summary is only for tables/tooltips
    return docstring.description ? escapeMdx(docstring.description) : "";
}
