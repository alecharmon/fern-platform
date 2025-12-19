/**
 * Render PythonFunctionIR to MDX.
 */

import type { FdrLambda } from "@fern-api/fdr-lambda-sdk";
import { formatTypeAnnotation, generateAnchorId, renderDocstring } from "../base/index.js";

/**
 * Render a function or method to MDX (full form for module-level functions).
 */
export function renderFunction(func: FdrLambda.libraryDocs.PythonFunctionIr): string {
    const lines: string[] = [];

    // Anchor for cross-referencing
    const anchorId = generateAnchorId(func.path);
    lines.push(`<Anchor id="${anchorId}">`);
    lines.push("");

    // Signature in code block
    lines.push("```python");
    lines.push(func.signature);
    lines.push("```");
    lines.push("");
    lines.push("</Anchor>");
    lines.push("");

    // Badges for special method types
    const badges = getMethodBadges(func);
    if (badges.length > 0) {
        lines.push(badges.map((b) => `<Badge>${b}</Badge>`).join(" "));
        lines.push("");
    }

    // Build param annotations map for docstring rendering
    const paramAnnotations: Record<string, string> = {};
    for (const param of func.parameters) {
        if (param.type) {
            paramAnnotations[param.name] = param.type;
        }
    }

    // Docstring with parameters
    if (func.docstring) {
        const docstringMdx = renderDocstring(func.docstring, paramAnnotations, func.returnType ?? undefined);
        if (docstringMdx) {
            lines.push(docstringMdx);
            lines.push("");
        }
    }

    return lines.join("\n");
}

/**
 * Render a method in compact form (for inside class accordions).
 */
export function renderMethodCompact(func: FdrLambda.libraryDocs.PythonFunctionIr): string {
    const lines: string[] = [];

    const anchorId = generateAnchorId(func.path);

    // Format compact signature for heading
    const compactSig = formatMethodSignatureCompact(func);

    // Method as a sub-heading with anchor
    lines.push(`<Anchor id="${anchorId}">`);
    lines.push(`##### \`${compactSig}\``);
    lines.push("</Anchor>");
    lines.push("");

    // Badges for special method types
    const badges = getMethodBadges(func);
    if (badges.length > 0) {
        lines.push(badges.map((b) => `<Badge>${b}</Badge>`).join(" "));
        lines.push("");
    }

    // Build param annotations map
    const paramAnnotations: Record<string, string> = {};
    for (const param of func.parameters) {
        if (param.type) {
            paramAnnotations[param.name] = param.type;
        }
    }

    // Docstring
    if (func.docstring) {
        const docstringMdx = renderDocstring(func.docstring, paramAnnotations, func.returnType ?? undefined);
        if (docstringMdx) {
            lines.push(docstringMdx);
        }
    }

    return lines.join("\n");
}

/**
 * Render a property to MDX.
 */
export function renderProperty(func: FdrLambda.libraryDocs.PythonFunctionIr): string {
    const lines: string[] = [];

    const anchorId = generateAnchorId(func.path);

    // Property as inline signature
    const returnType = func.returnType ? `: ${formatTypeAnnotation(func.returnType)}` : "";

    lines.push(`<Anchor id="${anchorId}">`);
    lines.push(`##### \`${func.name}${returnType}\``);
    lines.push("</Anchor>");
    lines.push("");

    lines.push(`<Badge>property</Badge>`);
    lines.push("");

    // Docstring (simple, no params for property)
    if (func.docstring) {
        const docstringMdx = renderDocstring(func.docstring);
        if (docstringMdx) {
            lines.push(docstringMdx);
        }
    }

    return lines.join("\n");
}

/**
 * Format a compact method signature for display.
 */
function formatMethodSignatureCompact(func: FdrLambda.libraryDocs.PythonFunctionIr): string {
    // Filter out self/cls
    const params = func.parameters.filter((p) => !["self", "cls"].includes(p.name));

    // Build param string
    const paramStrs = params.map((p) => {
        let s = p.name;
        // Only add type if compact enough
        if (p.type && p.type.length < 20) {
            s += `: ${p.type}`;
        }
        return s;
    });

    const paramsStr = paramStrs.join(", ");
    const asyncPrefix = func.isAsync ? "async " : "";
    const returnStr = func.returnType ? ` → ${formatTypeAnnotation(func.returnType)}` : "";

    // Truncate if too long
    if (paramsStr.length > 40) {
        return `${asyncPrefix}${func.name}(...)${returnStr}`;
    }

    return `${asyncPrefix}${func.name}(${paramsStr})${returnStr}`;
}

/**
 * Get badges for a method based on its properties.
 */
function getMethodBadges(func: FdrLambda.libraryDocs.PythonFunctionIr): string[] {
    const badges: string[] = [];

    if (func.isAsync) {
        badges.push("async");
    }
    if (func.isClassmethod) {
        badges.push("classmethod");
    }
    if (func.isStaticmethod) {
        badges.push("staticmethod");
    }
    if (func.isProperty) {
        badges.push("property");
    }

    // Check for abstractmethod decorator
    if (func.decorators.some((d) => d.includes("abstractmethod"))) {
        badges.push("abstract");
    }

    return badges;
}

/**
 * Get decorators worth mentioning (excluding ones shown as badges).
 */
function _getNotableDecorators(func: FdrLambda.libraryDocs.PythonFunctionIr): string[] {
    const skip = new Set(["staticmethod", "classmethod", "property", "abstractmethod"]);
    return func.decorators.filter((d) => !skip.has(d) && !Array.from(skip).some((s) => d.includes(s)));
}
