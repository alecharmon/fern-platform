/**
 * Render PythonClassIR to MDX.
 */

import type { FdrLambda } from "@fern-api/fdr-lambda-sdk";
import {
    escapeMdx,
    escapeTableCell,
    formatTypeAnnotation,
    generateAnchorId,
    renderDocstring,
    renderSimpleDocstring
} from "../base/index.js";
import { renderMethodCompact } from "./FunctionRenderer.js";

/**
 * Render a class to MDX.
 */
export function renderClass(cls: FdrLambda.libraryDocs.PythonClassIr): string {
    switch (cls.kind) {
        case "TYPEDDICT":
            return renderTypedDict(cls);
        case "ENUM":
            return renderEnum(cls);
        default:
            return renderRegularClass(cls);
    }
}

/**
 * Render a regular class, protocol, dataclass, or exception.
 */
function renderRegularClass(cls: FdrLambda.libraryDocs.PythonClassIr): string {
    const lines: string[] = [];

    // Anchor for the class
    const anchorId = generateAnchorId(cls.path);

    // Build class signature for accordion title
    const signaturePreview = formatClassSignatureCompact(cls);

    // Use Accordion for collapsible class view
    lines.push(`<Accordion title="${escapeMdx(signaturePreview)}" id="${anchorId}">`);
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

    // Full signature in code block (for copy-paste)
    const fullSignature = formatClassSignature(cls);
    lines.push("```python");
    lines.push(fullSignature);
    lines.push("```");
    lines.push("");

    // Base classes (if interesting)
    if (cls.bases.length > 0 && !["TYPEDDICT", "ENUM"].includes(cls.kind)) {
        const interestingBases = cls.bases.filter((b) => !["object", "ABC", "Protocol", "TypedDict"].includes(b));
        if (interestingBases.length > 0) {
            const basesStr = interestingBases.map((b) => `\`${b}\``).join(", ");
            lines.push(`**Inherits from:** ${basesStr}`);
            lines.push("");
        }
    }

    // Class docstring
    if (cls.docstring) {
        // Build param annotations from constructor params
        const paramAnnotations: Record<string, string> = {};
        for (const param of cls.constructorParams) {
            if (param.type) {
                paramAnnotations[param.name] = param.type;
            }
        }

        const docstringMdx = renderDocstring(cls.docstring, paramAnnotations);
        if (docstringMdx) {
            lines.push(docstringMdx);
            lines.push("");
        }
    }

    // Class attributes (filtered to only show meaningful ones)
    const meaningfulAttrs = cls.attributes.filter((attr) => isAttributeMeaningful(attr));
    if (meaningfulAttrs.length > 0) {
        lines.push("#### Attributes");
        lines.push("");
        for (const attr of meaningfulAttrs) {
            lines.push(renderAttributeCompact(attr));
            lines.push("");
        }
    }

    // Methods
    const methods = cls.methods.filter((m) => m.name !== "__init__");
    if (methods.length > 0) {
        lines.push("#### Methods");
        lines.push("");
        for (const method of methods) {
            lines.push(renderMethodCompact(method));
            lines.push("");
        }
    }

    lines.push("</Accordion>");

    return lines.join("\n");
}

/**
 * Render a TypedDict class.
 */
function renderTypedDict(cls: FdrLambda.libraryDocs.PythonClassIr): string {
    const lines: string[] = [];

    const anchorId = generateAnchorId(cls.path);

    lines.push(`<Accordion title="class ${cls.name}" id="${anchorId}">`);
    lines.push("");

    lines.push(`<Badge>TypedDict</Badge>`);
    lines.push("");

    // Docstring
    if (cls.docstring) {
        const docstringMdx = renderSimpleDocstring(cls.docstring);
        if (docstringMdx) {
            lines.push(docstringMdx);
            lines.push("");
        }
    }

    // Fields as a table for cleaner display
    if (cls.typedDictFields && cls.typedDictFields.length > 0) {
        lines.push("**Fields:**");
        lines.push("");
        lines.push("| Field | Type | Required | Description |");
        lines.push("|-------|------|----------|-------------|");
        for (const field of cls.typedDictFields) {
            // Escape pipe characters in type annotations (they break markdown tables)
            const typeStr = field.type ? `\`${escapeTableCell(field.type)}\`` : "-";
            const reqStr = field.required ? "Yes" : "No";
            const descStr = field.description ? escapeTableCell(field.description) : "-";
            lines.push(`| \`${field.name}\` | ${typeStr} | ${reqStr} | ${descStr} |`);
        }
        lines.push("");
    }

    lines.push("</Accordion>");

    return lines.join("\n");
}

/**
 * Render an Enum class.
 */
function renderEnum(cls: FdrLambda.libraryDocs.PythonClassIr): string {
    const lines: string[] = [];

    const anchorId = generateAnchorId(cls.path);

    lines.push(`<Accordion title="class ${cls.name}" id="${anchorId}">`);
    lines.push("");

    lines.push(`<Badge>Enum</Badge>`);
    lines.push("");

    // Docstring
    if (cls.docstring) {
        const docstringMdx = renderSimpleDocstring(cls.docstring);
        if (docstringMdx) {
            lines.push(docstringMdx);
            lines.push("");
        }
    }

    // Enum members as table
    if (cls.enumMembers && cls.enumMembers.length > 0) {
        lines.push("**Values:**");
        lines.push("");
        lines.push("| Name | Value |");
        lines.push("|------|-------|");
        for (const member of cls.enumMembers) {
            lines.push(`| \`${member.name}\` | \`${escapeMdx(member.value)}\` |`);
        }
        lines.push("");
    }

    lines.push("</Accordion>");

    return lines.join("\n");
}

/**
 * Format a compact class signature for accordion title.
 */
function formatClassSignatureCompact(cls: FdrLambda.libraryDocs.PythonClassIr): string {
    if (cls.constructorParams.length === 0) {
        return `class ${cls.name}`;
    }

    // Just show param names, no types
    const paramNames = cls.constructorParams.map((p) => p.name).join(", ");
    if (paramNames.length > 50) {
        return `class ${cls.name}(...)`;
    }
    return `class ${cls.name}(${paramNames})`;
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
        if (param.type) {
            paramStr += `: ${formatTypeAnnotation(param.type)}`;
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
    if (attr.type && attr.type !== "Any") {
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
 * Render an attribute in compact form.
 */
function renderAttributeCompact(attr: FdrLambda.libraryDocs.AttributeIr): string {
    const lines: string[] = [];

    const anchorId = generateAnchorId(attr.path);

    // Inline signature
    const typeStr = attr.type ? `: ${formatTypeAnnotation(attr.type)}` : "";
    const valueStr = attr.value && attr.value.length <= 30 ? ` = ${attr.value}` : "";

    lines.push(`<Anchor id="${anchorId}">`);
    lines.push(`**\`${attr.name}${typeStr}${valueStr}\`**`);
    lines.push("</Anchor>");

    // Docstring on next line if present
    if (attr.docstring) {
        const docstringMdx = renderSimpleDocstring(attr.docstring);
        if (docstringMdx) {
            lines.push("");
            lines.push(docstringMdx);
        }
    }

    return lines.join("\n");
}
