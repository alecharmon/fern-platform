/**
 * Render PythonModuleIR to MDX pages.
 *
 * Layout follows the pattern:
 * 1. Module Contents - Summary tables for classes, functions, data
 * 2. API - Detailed definitions with anchors and indented content
 */

import type { FdrLambda } from "@fern-api/fdr-lambda-sdk";
import { createFrontmatter, escapeTableCell, generateAnchorId, renderSimpleDocstring } from "../base/index.js";
import { renderClassDetailed } from "./ClassRenderer.js";
import { renderFunctionDetailed } from "./FunctionRenderer.js";
import { getTypeDisplay } from "./TypeLinkResolver.js";

export interface RenderConfig {
    baseSlug: string;
}

/**
 * Render a module to an MDX page.
 */
export function renderModulePage(
    module: FdrLambda.libraryDocs.PythonModuleIr,
    config: RenderConfig,
    parentPath: string = ""
): string {
    const lines: string[] = [];

    // Determine slug
    const modulePath = parentPath ? `${parentPath}/${module.name}` : module.name;
    const slug = `${config.baseSlug}/${modulePath}`;

    // Frontmatter (includes title, so no need for separate H1)
    // Use full path (e.g., "nemo_rl.algorithms.dpo") for title
    lines.push(createFrontmatter(slug, module.path));
    lines.push("");

    // Module docstring
    if (module.docstring) {
        const docstringMdx = renderSimpleDocstring(module.docstring);
        if (docstringMdx) {
            lines.push(docstringMdx);
            lines.push("");
        }
    }

    // Determine what sections we have
    const hasClasses = module.classes.length > 0;
    const hasFunctions = module.functions.length > 0;
    const hasAttributes = module.attributes.length > 0;
    const hasContent = hasClasses || hasFunctions || hasAttributes;

    if (hasContent) {
        lines.push("## Module Contents");
        lines.push("");

        // Classes summary table
        if (hasClasses) {
            lines.push("### Classes");
            lines.push("");
            lines.push("| Name | Description |");
            lines.push("|------|-------------|");
            for (const cls of module.classes) {
                const anchorId = generateAnchorId(cls.path);
                const description = cls.docstring?.summary ? escapeTableCell(cls.docstring.summary) : "-";
                lines.push(`| [\`${cls.name}\`](#${anchorId}) | ${description} |`);
            }
            lines.push("");
        }

        // Functions summary table
        if (hasFunctions) {
            lines.push("### Functions");
            lines.push("");
            lines.push("| Name | Description |");
            lines.push("|------|-------------|");
            for (const func of module.functions) {
                const anchorId = generateAnchorId(func.path);
                const description = func.docstring?.summary ? escapeTableCell(func.docstring.summary) : "-";
                lines.push(`| [\`${func.name}\`](#${anchorId}) | ${description} |`);
            }
            lines.push("");
        }

        // Data/Constants summary
        if (hasAttributes) {
            lines.push("### Data");
            lines.push("");
            for (const attr of module.attributes) {
                const anchorId = generateAnchorId(attr.path);
                lines.push(`[\`${attr.name}\`](#${anchorId})`);
                lines.push("");
            }
        }

        // API section with detailed definitions
        // Note: Items are currently grouped by type. See ISSUES.md Issue #14
        // for tracking source-order preservation enhancement.
        lines.push("### API");
        lines.push("");

        for (const cls of module.classes) {
            lines.push(renderClassDetailed(cls, config.baseSlug));
            lines.push("");
        }

        for (const func of module.functions) {
            lines.push(renderFunctionDetailed(func, config.baseSlug));
            lines.push("");
        }

        for (const attr of module.attributes) {
            lines.push(renderAttributeDetailed(attr));
            lines.push("");
        }
    }

    return lines.join("\n");
}

/**
 * Render a module-level attribute/constant in detail.
 */
function renderAttributeDetailed(attr: FdrLambda.libraryDocs.AttributeIr): string {
    const lines: string[] = [];

    const anchorId = generateAnchorId(attr.path);

    lines.push(`<Anchor id="${anchorId}">`);
    lines.push("");

    // Signature
    const attrTypeDisplay = getTypeDisplay(attr.typeInfo);
    const typeStr = attrTypeDisplay ? `: ${attrTypeDisplay}` : "";
    const valueStr = attr.value && attr.value.length <= 50 ? ` = ${attr.value}` : "";

    lines.push("```python");
    lines.push(`${attr.name}${typeStr}${valueStr}`);
    lines.push("```");
    lines.push("</Anchor>");
    lines.push("");

    // Docstring if present
    if (attr.docstring) {
        lines.push("<Indent>");
        lines.push("");
        const docstringMdx = renderSimpleDocstring(attr.docstring);
        if (docstringMdx) {
            lines.push(docstringMdx);
        }
        lines.push("");
        lines.push("</Indent>");
    }

    return lines.join("\n");
}

/**
 * Render a section overview page that lists submodules.
 */
export function renderSectionOverviewPage(
    module: FdrLambda.libraryDocs.PythonModuleIr,
    config: RenderConfig,
    modulePath: string
): string {
    const lines: string[] = [];

    const slug = `${config.baseSlug}/${modulePath}`;

    // Frontmatter - use full path for title (e.g., "nemo_rl.algorithms")
    lines.push(createFrontmatter(slug, module.path));
    lines.push("");

    // Module docstring if present
    if (module.docstring) {
        const docstringMdx = renderSimpleDocstring(module.docstring);
        if (docstringMdx) {
            lines.push(docstringMdx);
            lines.push("");
        }
    }

    // Submodules section
    lines.push("## Submodules");
    lines.push("");

    for (const submodule of module.submodules) {
        // Use full absolute path for the link
        const submodulePath = `${modulePath}/${submodule.name}`;
        const submoduleLink = `/${config.baseSlug}/${submodulePath}`;

        // Use docstring summary as description if available
        let description = "";
        if (submodule.docstring?.summary) {
            description = ` - ${submodule.docstring.summary}`;
        }

        lines.push(`- **[\`${submodule.name}\`](${submoduleLink})**${description}`);
    }
    lines.push("");

    return lines.join("\n");
}

/**
 * Recursively render all modules to pages.
 */
export function renderAllModulePages(
    rootModule: FdrLambda.libraryDocs.PythonModuleIr,
    config: RenderConfig
): Record<string, string> {
    const pages: Record<string, string> = {};

    function renderModule(module: FdrLambda.libraryDocs.PythonModuleIr, parentPath: string = ""): void {
        const modulePath = parentPath ? `${parentPath}/${module.name}` : module.name;

        // Check if module has direct content (classes, functions, attributes)
        const hasDirectContent =
            module.classes.length > 0 ||
            module.functions.length > 0 ||
            module.attributes.length > 0 ||
            module.docstring;

        // Check if module has submodules
        const hasSubmodules = module.submodules.length > 0;

        if (hasDirectContent) {
            // Module has content - render a content page
            const pageKey = `${config.baseSlug}/${modulePath}.mdx`;
            pages[pageKey] = renderModulePage(module, config, parentPath);
        }

        if (hasSubmodules) {
            // Module has submodules - render an overview page for the section
            const pageKey = `${config.baseSlug}/${modulePath}-overview.mdx`;
            pages[pageKey] = renderSectionOverviewPage(module, config, modulePath);
        }

        // Recurse into submodules
        for (const submodule of module.submodules) {
            renderModule(submodule, modulePath);
        }
    }

    renderModule(rootModule);
    return pages;
}
