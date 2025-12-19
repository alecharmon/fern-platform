/**
 * PythonRenderer - Convert PythonLibraryDocsIR to MDX pages.
 *
 * This is the main entry point for rendering Python library documentation
 * from IR to MDX format.
 */

import type { FdrLambda } from "@fern-api/fdr-lambda-sdk";
import type { NavigationItem, RenderedOutput } from "../base/index.js";
import { type RenderConfig, renderAllModulePages } from "./ModuleRenderer.js";

export interface PythonRendererConfig {
    baseSlug?: string;
}

/**
 * Renderer for Python library documentation.
 *
 * Takes PythonLibraryDocsIR (from Lambda) and produces MDX pages.
 */
export class PythonRenderer {
    private config: RenderConfig;

    constructor(config: PythonRendererConfig = {}) {
        this.config = {
            baseSlug: config.baseSlug ?? "api-reference"
        };
    }

    /**
     * Render IR to MDX pages and navigation.
     */
    render(ir: FdrLambda.libraryDocs.PythonLibraryDocsIr): RenderedOutput {
        // Render all module pages
        const pages = renderAllModulePages(ir.rootModule, this.config);

        // Generate navigation from module tree
        const navigation = this.generateNavigation(ir.rootModule);

        return {
            pages,
            navigation
        };
    }

    /**
     * Generate navigation structure from module tree.
     */
    private generateNavigation(rootModule: FdrLambda.libraryDocs.PythonModuleIr): NavigationItem[] {
        const contents = this.generateModuleNav(rootModule, "");

        // Wrap in API Reference section
        return [
            {
                type: "section",
                value: {
                    title: "API Reference",
                    contents
                }
            }
        ];
    }

    /**
     * Recursively generate navigation for a module and its children.
     */
    private generateModuleNav(module: FdrLambda.libraryDocs.PythonModuleIr, parentPath: string): NavigationItem[] {
        const items: NavigationItem[] = [];
        const modulePath = parentPath ? `${parentPath}/${module.name}` : module.name;

        // Check if module has content worth showing
        const hasContent =
            module.classes.length > 0 ||
            module.functions.length > 0 ||
            module.attributes.length > 0 ||
            module.docstring != null;

        // Add page for this module if it has content
        if (hasContent) {
            items.push({
                type: "page",
                value: {
                    title: module.name,
                    slug: `${this.config.baseSlug}/${modulePath}`
                }
            });
        }

        // Process submodules
        for (const submodule of module.submodules) {
            const subItems = this.generateModuleNav(submodule, modulePath);

            if (subItems.length === 0) {
                // No items - skip
                continue;
            } else if (subItems.length === 1) {
                // Single item - add directly (whether page or section)
                items.push(subItems[0]!);
            } else {
                // Multiple items - create a section
                items.push({
                    type: "section",
                    value: {
                        title: submodule.name,
                        contents: subItems
                    }
                });
            }
        }

        return items;
    }
}
