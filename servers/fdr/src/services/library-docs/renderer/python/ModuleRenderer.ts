/**
 * Render PythonModuleIR to MDX pages.
 */

import type { FdrLambda } from "@fern-api/fdr-lambda-sdk";
import { createFrontmatter, escapeMdx, renderSimpleDocstring } from "../base/index.js";
import { renderClass } from "./ClassRenderer.js";
import { renderFunction } from "./FunctionRenderer.js";

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

    // Frontmatter
    lines.push(createFrontmatter(slug, module.name));
    lines.push("");

    // Title
    lines.push(`# ${module.name}`);
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
        lines.push("## API Reference");
        lines.push("");
    }

    // Classes - wrapped in AccordionGroup for collapsible view
    if (hasClasses) {
        lines.push("### Classes");
        lines.push("");
        lines.push("<AccordionGroup>");
        lines.push("");
        for (const cls of module.classes) {
            lines.push(renderClass(cls));
            lines.push("");
        }
        lines.push("</AccordionGroup>");
        lines.push("");
    }

    // Functions
    if (hasFunctions) {
        lines.push("### Functions");
        lines.push("");
        for (const func of module.functions) {
            lines.push(renderFunction(func));
            lines.push("");
        }
    }

    // Module-level attributes/constants
    if (hasAttributes) {
        lines.push("### Constants");
        lines.push("");
        for (const attr of module.attributes) {
            lines.push(renderModuleAttribute(attr));
            lines.push("");
        }
    }

    return lines.join("\n");
}

/**
 * Render a module-level attribute/constant.
 */
function renderModuleAttribute(attr: FdrLambda.libraryDocs.AttributeIr): string {
    const lines: string[] = [];

    lines.push(`#### ${attr.name}`);
    lines.push("");

    if (attr.type) {
        lines.push(`**Type:** \`${escapeMdx(attr.type)}\``);
        lines.push("");
    }

    if (attr.value && attr.value.length <= 100) {
        lines.push(`**Value:** \`${escapeMdx(attr.value)}\``);
        lines.push("");
    }

    if (attr.docstring) {
        const docstringMdx = renderSimpleDocstring(attr.docstring);
        if (docstringMdx) {
            lines.push(docstringMdx);
            lines.push("");
        }
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

        // Only create a page if the module has content
        const hasContent =
            module.classes.length > 0 ||
            module.functions.length > 0 ||
            module.attributes.length > 0 ||
            module.docstring;

        if (hasContent) {
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
