/**
 * Render PythonFunctionIR to MDX.
 */

import type { FdrLambda } from "@fern-api/fdr-lambda-sdk";
import { generateAnchorId, renderDocstring } from "../base/index.js";
import {
    extractLinksFromTypes,
    formatSignatureMultiline,
    getModulePath,
    getTypeDisplay,
    getTypePathForSignature,
    type RenderContext,
    renderCodeBlockWithLinks,
    type SignatureParam
} from "./TypeLinkResolver.js";

interface FunctionSignature {
    code: string;
    typeStrings: string[];
}

/**
 * Build signature code and collect type strings for link extraction in one pass.
 */
function buildFunctionSignature(
    func: FdrLambda.libraryDocs.PythonFunctionIr,
    omitSelf: boolean = false
): FunctionSignature {
    const rawParams = omitSelf ? func.parameters.filter((p) => p.name !== "self" && p.name !== "cls") : func.parameters;

    const params: SignatureParam[] = [];
    const typeStrings: string[] = [];

    for (const param of rawParams) {
        const type = getTypePathForSignature(param.typeInfo) || undefined;
        if (type) {
            typeStrings.push(type);
        }
        params.push({ name: param.name, type, defaultValue: param.default || undefined });
    }

    const returnType = getTypePathForSignature(func.returnTypeInfo);
    if (returnType) {
        typeStrings.push(returnType);
    }

    const code = formatSignatureMultiline(func.path, params, returnType ? [returnType] : undefined);
    return { code, typeStrings };
}

/**
 * Build param annotations map for docstring rendering.
 */
function buildParamAnnotations(func: FdrLambda.libraryDocs.PythonFunctionIr): Record<string, string> {
    const annotations: Record<string, string> = {};
    for (const param of func.parameters) {
        const typeDisplay = getTypeDisplay(param.typeInfo);
        if (typeDisplay) {
            annotations[param.name] = typeDisplay;
        }
    }
    return annotations;
}

/**
 * Get badges for special method types.
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
    if (func.decorators.some((d) => d.includes("abstractmethod"))) {
        badges.push("abstract");
    }
    return badges;
}

/**
 * Render a function in detailed form for the API section.
 */
export function renderFunctionDetailed(func: FdrLambda.libraryDocs.PythonFunctionIr, ctx: RenderContext): string {
    const lines: string[] = [];
    const currentModulePath = getModulePath(func.path);

    // Anchor
    lines.push(`<Anchor id="${generateAnchorId(func.path)}">`);
    lines.push("");

    // Signature with links (extracted from param/return types only)
    const { code, typeStrings } = buildFunctionSignature(func);
    const links = extractLinksFromTypes(typeStrings, ctx, currentModulePath);
    lines.push(renderCodeBlockWithLinks(code, links));
    lines.push("</Anchor>");
    lines.push("");

    // Content
    lines.push("<Indent>");
    lines.push("");

    // Badges
    const badges = getMethodBadges(func);
    if (badges.length > 0) {
        lines.push(badges.map((b) => `<Badge>${b}</Badge>`).join(" "));
        lines.push("");
    }

    // Docstring
    if (func.docstring) {
        const docstringMdx = renderDocstring(
            func.docstring,
            buildParamAnnotations(func),
            getTypeDisplay(func.returnTypeInfo) || undefined
        );
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
    ctx: RenderContext,
    currentModulePath?: string
): string {
    const lines: string[] = [];
    const modulePath = currentModulePath ?? getModulePath(func.path);

    // Anchor
    lines.push(`<Anchor id="${generateAnchorId(func.path)}">`);
    lines.push("");

    // Signature with links (omit self/cls for methods)
    const { code, typeStrings } = buildFunctionSignature(func, true);
    const links = extractLinksFromTypes(typeStrings, ctx, modulePath);
    lines.push(renderCodeBlockWithLinks(code, links));
    lines.push("</Anchor>");
    lines.push("");

    // Content
    lines.push("<Indent>");
    lines.push("");

    // Badges
    const badges = getMethodBadges(func);
    if (badges.length > 0) {
        lines.push(badges.map((b) => `<Badge>${b}</Badge>`).join(" "));
        lines.push("");
    }

    // Docstring
    if (func.docstring) {
        const docstringMdx = renderDocstring(
            func.docstring,
            buildParamAnnotations(func),
            getTypeDisplay(func.returnTypeInfo) || undefined
        );
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
    ctx: RenderContext,
    currentModulePath?: string
): string {
    const lines: string[] = [];
    const modulePath = currentModulePath ?? getModulePath(func.path);

    // Property signature: name: Type
    const typeDisplay = getTypePathForSignature(func.returnTypeInfo);
    const signature = typeDisplay ? `${func.name}: ${typeDisplay}` : func.name;
    const links = typeDisplay ? extractLinksFromTypes([typeDisplay], ctx, modulePath) : {};

    // Anchor
    lines.push(`<Anchor id="${generateAnchorId(func.path)}">`);
    lines.push("");
    lines.push(renderCodeBlockWithLinks(signature, links));
    lines.push("</Anchor>");
    lines.push("");

    // Docstring
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
