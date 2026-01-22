/**
 * Render PythonClassIR to MDX.
 *
 * Classes are rendered with:
 * - Anchor with class signature in code block
 * - Indent containing bases, docstring, attributes, and methods
 */

import type { FdrLambda } from "@fern-api/fdr-lambda-sdk";
import {
    escapeMdx,
    formatTypeAnnotation,
    generateAnchorId,
    renderDocstring,
    renderSimpleDocstring
} from "../base/index.js";
import { renderMethodDetailed, renderProperty } from "./FunctionRenderer.js";
import { getTypeDisplay, linkTypeInfo } from "./TypeLinkResolver.js";

/**
 * Render a class in detailed form for the API section.
 */
export function renderClassDetailed(cls: FdrLambda.libraryDocs.PythonClassIr, baseSlug: string): string {
    switch (cls.kind) {
        case "TYPEDDICT":
            return renderTypedDictDetailed(cls, baseSlug);
        case "ENUM":
            return renderEnumDetailed(cls);
        default:
            return renderRegularClassDetailed(cls, baseSlug);
    }
}

/**
 * Extract module path from a fully qualified class path.
 * e.g., "nemo_rl.algorithms.dpo.MasterConfig" -> "nemo_rl.algorithms.dpo"
 */
function getModulePath(path: string): string {
    const parts = path.split(".");
    return parts.slice(0, -1).join(".");
}

/**
 * Render a regular class, protocol, dataclass, or exception in detailed form.
 */
function renderRegularClassDetailed(cls: FdrLambda.libraryDocs.PythonClassIr, baseSlug: string): string {
    const lines: string[] = [];
    const currentModulePath = getModulePath(cls.path);

    // Anchor for the class
    const anchorId = generateAnchorId(cls.path);

    lines.push(`<Anchor id="${anchorId}">`);
    lines.push("");

    // Class signature in code block
    const fullSignature = formatClassSignature(cls);
    lines.push("```python");
    lines.push(fullSignature);
    lines.push("```");
    lines.push("</Anchor>");
    lines.push("");

    // Wrap class body content in Indent
    lines.push("<Indent>");
    lines.push("");

    // Kind badge for special types
    const badges: string[] = [];
    if (cls.kind === "PROTOCOL") {
        badges.push("Protocol");
    }
    if (cls.kind === "DATACLASS") {
        badges.push("Dataclass");
    }
    if (cls.kind === "EXCEPTION") {
        badges.push("Exception");
    }
    if (cls.isAbstract) {
        badges.push("Abstract");
    }

    if (badges.length > 0) {
        lines.push(badges.map((b) => `<Badge>${b}</Badge>`).join(" "));
        lines.push("");
    }

    // Base classes
    if (cls.bases.length > 0 && !["TYPEDDICT", "ENUM"].includes(cls.kind)) {
        const interestingBases = cls.bases.filter((b) => !["object", "ABC", "Protocol", "TypedDict"].includes(b.name));
        if (interestingBases.length > 0) {
            const basesStr = interestingBases
                .map((b) => {
                    if (b.typeInfo) {
                        return linkTypeInfo(b.typeInfo, baseSlug, currentModulePath);
                    }
                    return `\`${b.name}\``;
                })
                .join(", ");
            lines.push(`**Bases:** ${basesStr}`);
            lines.push("");
        }
    }

    // Class docstring
    if (cls.docstring) {
        // Build param annotations from constructor params
        const paramAnnotations: Record<string, string> = {};
        for (const param of cls.constructorParams) {
            const typeDisplay = getTypeDisplay(param.typeInfo);
            if (typeDisplay) {
                paramAnnotations[param.name] = typeDisplay;
            }
        }

        const docstringMdx = renderDocstring(cls.docstring, paramAnnotations);
        if (docstringMdx) {
            lines.push(docstringMdx);
            lines.push("");
        }
    }

    // Class attributes (rendered inline with anchors and type links)
    const meaningfulAttrs = cls.attributes.filter((attr) => isAttributeMeaningful(attr));
    for (const attr of meaningfulAttrs) {
        lines.push(renderAttributeInline(attr, baseSlug, currentModulePath));
        lines.push("");
    }

    // Methods (rendered with anchors and indent)
    const methods = cls.methods.filter((m) => m.name !== "__init__");
    for (const method of methods) {
        if (method.isProperty) {
            lines.push(renderProperty(method, baseSlug, currentModulePath));
        } else {
            lines.push(renderMethodDetailed(method, baseSlug, currentModulePath));
        }
        lines.push("");
    }

    lines.push("</Indent>");

    return lines.join("\n");
}

/**
 * Render a TypedDict class in detailed form.
 */
function renderTypedDictDetailed(cls: FdrLambda.libraryDocs.PythonClassIr, _baseSlug: string): string {
    const lines: string[] = [];

    const anchorId = generateAnchorId(cls.path);

    lines.push(`<Anchor id="${anchorId}">`);
    lines.push("");
    lines.push("```python");
    lines.push(`class ${cls.path}`);
    lines.push("```");
    lines.push("</Anchor>");
    lines.push("");

    lines.push("<Indent>");
    lines.push("");

    lines.push(`**Bases:** \`typing.TypedDict\``);
    lines.push("");

    // Docstring
    if (cls.docstring) {
        const docstringMdx = renderSimpleDocstring(cls.docstring);
        if (docstringMdx) {
            lines.push(docstringMdx);
            lines.push("");
        }
    }

    // Fields using ParamField
    if (cls.typedDictFields && cls.typedDictFields.length > 0) {
        for (const field of cls.typedDictFields) {
            const typeDisplay = getTypeDisplay(field.typeInfo) ?? "Any";
            lines.push(`<ParamField path="${field.name}" type="${escapeMdx(typeDisplay)}">`);
            if (field.description) {
                lines.push(escapeMdx(field.description));
            }
            lines.push("</ParamField>");
            lines.push("");
        }
    }

    lines.push("</Indent>");

    return lines.join("\n");
}

/**
 * Render an Enum class in detailed form.
 */
function renderEnumDetailed(cls: FdrLambda.libraryDocs.PythonClassIr): string {
    const lines: string[] = [];

    const anchorId = generateAnchorId(cls.path);

    lines.push(`<Anchor id="${anchorId}">`);
    lines.push("");
    lines.push("```python");
    lines.push(`class ${cls.path}`);
    lines.push("```");
    lines.push("</Anchor>");
    lines.push("");

    lines.push("<Indent>");
    lines.push("");

    lines.push(`**Bases:** \`enum.Enum\``);
    lines.push("");

    // Docstring
    if (cls.docstring) {
        const docstringMdx = renderSimpleDocstring(cls.docstring);
        if (docstringMdx) {
            lines.push(docstringMdx);
            lines.push("");
        }
    }

    // Enum members using ParamField
    if (cls.enumMembers && cls.enumMembers.length > 0) {
        for (const member of cls.enumMembers) {
            lines.push(`<ParamField path="${member.name}" type="= ${escapeMdx(member.value)}">`);
            lines.push("</ParamField>");
            lines.push("");
        }
    }

    lines.push("</Indent>");

    return lines.join("\n");
}

/**
 * Format full class signature with constructor parameters.
 */
function formatClassSignature(cls: FdrLambda.libraryDocs.PythonClassIr): string {
    if (cls.constructorParams.length === 0) {
        return `class ${cls.path}`;
    }

    // Format parameters
    const paramStrs: string[] = [];
    for (const param of cls.constructorParams) {
        let paramStr = param.name;
        const typeDisplay = getTypeDisplay(param.typeInfo);
        if (typeDisplay) {
            paramStr += `: ${formatTypeAnnotation(typeDisplay)}`;
        }
        if (param.default) {
            let defaultStr = param.default;
            if (defaultStr.length > 30) {
                defaultStr = defaultStr.slice(0, 27) + "...";
            }
            paramStr += ` = ${defaultStr}`;
        }
        paramStrs.push(paramStr);
    }

    // Always use multiline for readability
    if (paramStrs.length > 2 || paramStrs.join(", ").length > 60) {
        const paramsFormatted = paramStrs.join(",\n    ");
        return `class ${cls.path}(\n    ${paramsFormatted}\n)`;
    } else {
        return `class ${cls.path}(${paramStrs.join(", ")})`;
    }
}

/**
 * Check if an attribute is meaningful (not just a redundant default).
 */
function isAttributeMeaningful(attr: FdrLambda.libraryDocs.AttributeIr): boolean {
    // Skip if default value equals the attribute name (e.g., master_config = master_config)
    if (attr.value && attr.value === attr.name) {
        return false;
    }

    // Keep if it has a docstring
    if (attr.docstring) {
        return true;
    }

    // Keep if it has a meaningful type annotation
    const typeDisplay = getTypeDisplay(attr.typeInfo);
    if (typeDisplay && typeDisplay !== "Any") {
        return true;
    }

    // Keep if it has a constant value (not just a variable reference)
    if (attr.value && !isVariableReference(attr.value)) {
        return true;
    }

    return false;
}

/**
 * Check if a value looks like a variable reference vs a constant.
 */
function isVariableReference(value: string): boolean {
    // Variable references are typically just identifiers
    return /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(value);
}

/**
 * Render an attribute using ParamField component.
 */
function renderAttributeInline(
    attr: FdrLambda.libraryDocs.AttributeIr,
    _baseSlug: string,
    _currentModulePath: string
): string {
    const lines: string[] = [];

    const typeDisplay = getTypeDisplay(attr.typeInfo);
    const defaultValue = attr.value && attr.value.length <= 50 ? attr.value : undefined;

    // Build type string with optional default value (e.g., "SomeType = value")
    let typeStr = typeDisplay || "";
    if (defaultValue) {
        typeStr = typeStr ? `${typeStr} = ${defaultValue}` : `= ${defaultValue}`;
    }

    // Build ParamField props
    const props: string[] = [`path="${attr.name}"`];
    if (typeStr) {
        props.push(`type="${escapeMdx(typeStr)}"`);
    }

    lines.push(`<ParamField ${props.join(" ")}>`);

    // Docstring as content
    if (attr.docstring) {
        const docstringMdx = renderSimpleDocstring(attr.docstring);
        if (docstringMdx) {
            lines.push(docstringMdx);
        }
    }

    lines.push("</ParamField>");

    return lines.join("\n");
}
