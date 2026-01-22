/**
 * Render PythonFunctionIR to MDX.
 */

import type { FdrLambda } from "@fern-api/fdr-lambda-sdk";
import { generateAnchorId, renderDocstring } from "../base/index.js";
import { buildCodeBlockLinks, getTypeDisplay, renderCodeBlockWithLinks } from "./TypeLinkResolver.js";

/**
 * Collect all TypeInfos from a function's parameters and return type.
 */
function collectTypeInfos(
    func: FdrLambda.libraryDocs.PythonFunctionIr
): (FdrLambda.libraryDocs.TypeInfo | undefined)[] {
    const typeInfos: (FdrLambda.libraryDocs.TypeInfo | undefined)[] = [];

    for (const param of func.parameters) {
        typeInfos.push(param.typeInfo);
    }

    typeInfos.push(func.returnTypeInfo);

    return typeInfos;
}

/**
 * Extract module path from a fully qualified function/class path.
 * e.g., "nemo_rl.algorithms.dpo._default_dpo_save_state" -> "nemo_rl.algorithms.dpo"
 */
function getModulePath(path: string): string {
    const parts = path.split(".");
    return parts.slice(0, -1).join(".");
}

/**
 * Render a function in detailed form for the API section.
 */
export function renderFunctionDetailed(func: FdrLambda.libraryDocs.PythonFunctionIr, baseSlug: string): string {
    const lines: string[] = [];

    // Anchor for cross-referencing
    const anchorId = generateAnchorId(func.path);
    lines.push(`<Anchor id="${anchorId}">`);
    lines.push("");

    // Build links for type references in signature
    const typeInfos = collectTypeInfos(func);
    const currentModulePath = getModulePath(func.path);
    const links = buildCodeBlockLinks(typeInfos, baseSlug, currentModulePath);

    // Signature in code block with type links
    lines.push(renderCodeBlockWithLinks(func.signature.replace(/^def /, ""), links));
    lines.push("</Anchor>");
    lines.push("");

    // Wrap content in Indent for visual hierarchy
    lines.push("<Indent>");
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
        const typeDisplay = getTypeDisplay(param.typeInfo);
        if (typeDisplay) {
            paramAnnotations[param.name] = typeDisplay;
        }
    }

    // Docstring with parameters
    const returnTypeDisplay = getTypeDisplay(func.returnTypeInfo);
    if (func.docstring) {
        const docstringMdx = renderDocstring(func.docstring, paramAnnotations, returnTypeDisplay || undefined);
        if (docstringMdx) {
            lines.push(docstringMdx);
        }
    }

    lines.push("");
    lines.push("</Indent>");

    return lines.join("\n");
}

/**
 * Render a method in detailed form (for inside class definitions).
 */
export function renderMethodDetailed(
    func: FdrLambda.libraryDocs.PythonFunctionIr,
    baseSlug: string,
    currentModulePath?: string
): string {
    const lines: string[] = [];

    const anchorId = generateAnchorId(func.path);

    lines.push(`<Anchor id="${anchorId}">`);
    lines.push("");

    // Build links for type references in signature
    const typeInfos = collectTypeInfos(func);
    const modulePath = currentModulePath ?? getModulePath(func.path);
    const links = buildCodeBlockLinks(typeInfos, baseSlug, modulePath);

    // Signature in code block with type links
    lines.push(renderCodeBlockWithLinks(func.signature.replace(/^def /, ""), links));
    lines.push("</Anchor>");
    lines.push("");

    // Wrap method content in Indent
    lines.push("<Indent>");
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
        const typeDisplay = getTypeDisplay(param.typeInfo);
        if (typeDisplay) {
            paramAnnotations[param.name] = typeDisplay;
        }
    }

    // Docstring
    const methodReturnTypeDisplay = getTypeDisplay(func.returnTypeInfo);
    if (func.docstring) {
        const docstringMdx = renderDocstring(func.docstring, paramAnnotations, methodReturnTypeDisplay || undefined);
        if (docstringMdx) {
            lines.push(docstringMdx);
        }
    }

    lines.push("");
    lines.push("</Indent>");

    return lines.join("\n");
}

/**
 * Render a property to MDX.
 */
export function renderProperty(
    func: FdrLambda.libraryDocs.PythonFunctionIr,
    baseSlug: string,
    currentModulePath?: string
): string {
    const lines: string[] = [];

    const anchorId = generateAnchorId(func.path);

    // Property signature
    const propReturnTypeDisplay = getTypeDisplay(func.returnTypeInfo);
    const returnType = propReturnTypeDisplay ? `: ${propReturnTypeDisplay}` : "";

    // Build links for the property's return type
    const modulePath = currentModulePath ?? getModulePath(func.path);
    const links = buildCodeBlockLinks([func.returnTypeInfo], baseSlug, modulePath);

    lines.push(`<Anchor id="${anchorId}">`);
    lines.push("");
    lines.push(renderCodeBlockWithLinks(`${func.name}${returnType}`, links));
    lines.push("</Anchor>");
    lines.push("");

    // Docstring (simple, no params for property)
    if (func.docstring) {
        lines.push("<Indent>");
        lines.push("");
        const docstringMdx = renderDocstring(func.docstring);
        if (docstringMdx) {
            lines.push(docstringMdx);
        }
        lines.push("");
        lines.push("</Indent>");
    }

    return lines.join("\n");
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
