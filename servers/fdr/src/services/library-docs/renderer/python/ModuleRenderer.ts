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

    // Submodules section (before Module Contents)
    if (module.submodules.length > 0) {
        lines.push(renderSubmodulesSection(module.submodules, config, modulePath));
    }

    // Determine what sections we have
    const hasClasses = module.classes.length > 0;
    const hasFunctions = module.functions.length > 0;
    const hasAttributes = module.attributes.length > 0;
    const hasContent = hasClasses || hasFunctions || hasAttributes;

    if (hasContent) {
        const contentsHeader = module.submodules.length > 0 ? "Package Contents" : "Module Contents";
        lines.push(`## ${contentsHeader}`);
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
 * Render a list of submodules, split into Subpackages (have children) and Submodules (leaf nodes).
 * This matches Python/Sphinx conventions where packages contain other modules.
 */
function renderSubmodulesSection(
    submodules: FdrLambda.libraryDocs.PythonModuleIr[],
    config: RenderConfig,
    modulePath: string
): string {
    const lines: string[] = [];

    // Split into packages (have submodules) vs modules (leaf nodes)
    const packages = submodules.filter((sub) => sub.submodules.length > 0);
    const modules = submodules.filter((sub) => sub.submodules.length === 0);

    const renderItem = (sub: FdrLambda.libraryDocs.PythonModuleIr): string => {
        const link = `/${config.baseSlug}/${modulePath}/${sub.name}`;
        return `- **[\`${sub.path}\`](${link})**`;
    };

    if (packages.length > 0) {
        lines.push("## Subpackages", "");
        for (const pkg of packages) {
            lines.push(renderItem(pkg));
        }
        lines.push("");
    }

    if (modules.length > 0) {
        lines.push("## Submodules", "");
        for (const mod of modules) {
            lines.push(renderItem(mod));
        }
        lines.push("");
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

    // Signature with value (truncated if too long)
    const attrTypeDisplay = getTypeDisplay(attr.typeInfo);
    const typeStr = attrTypeDisplay ? `: ${attrTypeDisplay}` : "";
    const maxValueLength = 80;
    const valueStr = attr.value
        ? ` = ${attr.value.length > maxValueLength ? attr.value.slice(0, maxValueLength) + "..." : attr.value}`
        : "";

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

        // Generate page if module has any documentable content
        // Submodules list is now included in renderModulePage, so no separate overview needed
        if (hasDirectContent || hasSubmodules) {
            const pageKey = `${config.baseSlug}/${modulePath}.mdx`;
            pages[pageKey] = renderModulePage(module, config, parentPath);
        }

        // Recurse into submodules
        for (const submodule of module.submodules) {
            renderModule(submodule, modulePath);
        }
    }

    renderModule(rootModule);
    return pages;
}
