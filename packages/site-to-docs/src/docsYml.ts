import { stringify } from "yaml";
import type {
    FernNavigation,
    FernNavigationItem,
    FernProduct,
    FernProductFile,
    FernTabDefinition,
    FernVersion
} from "./types.js";

/**
 * Options for generating docs.yml
 */
export interface DocsYmlOptions {
    /** Title for the documentation site */
    title?: string;
    /** Path to favicon */
    favicon?: string;
    /** Whether to include the schema reference comment */
    includeSchema?: boolean;
    /** Site ID for docs instance URL */
    siteId: string;
}

/**
 * Converts a FernNavigationItem to a plain object for YAML serialization.
 * Removes undefined/null properties.
 */
function navigationItemToObject(item: FernNavigationItem): Record<string, unknown> {
    const obj: Record<string, unknown> = {};

    // Section
    if (item.section !== undefined) {
        obj.section = item.section;
        if (item.contents) {
            obj.contents = item.contents.map(navigationItemToObject);
        }
        if (item.path) {
            obj.path = item.path;
        }
        if (item.collapsed !== undefined) {
            obj.collapsed = item.collapsed;
        }
        if (item.icon) {
            obj.icon = item.icon;
        }
        return obj;
    }

    // Page
    if (item.page !== undefined) {
        obj.page = item.page;
        if (item.path) {
            obj.path = item.path;
        }
        if (item.slug) {
            obj.slug = item.slug;
        }
        return obj;
    }

    // API reference
    if (item.api !== undefined) {
        obj.api = item.api;
        return obj;
    }

    // External link
    if (item.link !== undefined) {
        obj.link = item.link;
        if (item.href) {
            obj.href = item.href;
        }
        return obj;
    }

    // Tab layout
    if (item.tab !== undefined) {
        obj.tab = item.tab;
        if (item.layout) {
            obj.layout = item.layout.map(navigationItemToObject);
        }
        return obj;
    }

    return obj;
}

/**
 * Converts tab definitions to plain object for YAML.
 */
function tabDefinitionsToObject(tabs: Record<string, FernTabDefinition>): Record<string, Record<string, string>> {
    const obj: Record<string, Record<string, string>> = {};

    for (const [slug, def] of Object.entries(tabs)) {
        const tabObj: Record<string, string> = {
            "display-name": def.displayName
        };
        if (def.icon) {
            tabObj.icon = def.icon;
        }
        obj[slug] = tabObj;
    }

    return obj;
}

/**
 * Converts a FernVersion to plain object for YAML.
 * Note: Fern versions require a path to a separate .yml file.
 */
function versionToObject(version: FernVersion): Record<string, unknown> {
    const obj: Record<string, unknown> = {
        "display-name": version.displayName,
        path: version.path
    };

    if (version.availability) {
        obj.availability = version.availability;
    }

    return obj;
}

/**
 * Converts a FernProduct to plain object for YAML.
 * Note: Products in docs.yml only have path/href references, not inline navigation.
 */
function productToObject(product: FernProduct): Record<string, unknown> {
    const obj: Record<string, unknown> = {
        "display-name": product.displayName,
        slug: product.slug
    };

    if (product.path) {
        obj.path = product.path;
    }

    if (product.href) {
        obj.href = product.href;
    }

    if (product.icon) {
        obj.icon = product.icon;
    }

    if (product.subtitle) {
        obj.subtitle = product.subtitle;
    }

    if (product.versions) {
        obj.versions = product.versions.map(versionToObject);
    }

    return obj;
}

/**
 * Generates Fern docs.yml YAML content from a FernNavigation structure.
 *
 * @param navigation - The navigation structure to convert
 * @param options - Optional configuration
 * @returns YAML string content for docs.yml
 */
export function generateDocsYml(navigation: FernNavigation, options: DocsYmlOptions): string {
    const { title, favicon, includeSchema = true, siteId } = options;
    const instanceUrl = `${siteId}.docs.buildwithfern.com`;

    const doc: Record<string, unknown> = {};

    // Add title if provided
    if (title) {
        doc.title = title;
    }

    // Add favicon if provided
    if (favicon) {
        doc.favicon = favicon;
    }

    // Add tab definitions if present
    if (navigation.tabs) {
        doc.tabs = tabDefinitionsToObject(navigation.tabs);
    }

    // Add products if present (multi-product docs)
    if (navigation.products && navigation.products.length > 0) {
        doc.products = navigation.products.map(productToObject);
    }

    // Add navigation if present
    if (navigation.navigation) {
        doc.navigation = navigation.navigation.map(navigationItemToObject);
    }

    // Generate YAML
    const yaml = stringify(doc, {
        indent: 2,
        lineWidth: 120
    });

    // Build the output with optional schema comment
    let output = "";

    if (includeSchema) {
        output += "# yaml-language-server: $schema=https://schema.buildwithfern.dev/docs-yml.json\n\n";
    }

    // Add instances block (required for Fern docs)
    output += `instances:\n  - url: ${instanceUrl} # update this to {yourorg}.docs.buildwithfern.com\n\n`;

    output += yaml;

    return output;
}

/**
 * Generates YAML content for a product-specific .yml file.
 *
 * @param productFile - The product file content
 * @returns YAML string content for the product file
 */
export function generateProductFileYml(productFile: FernProductFile): string {
    const doc: Record<string, unknown> = {};

    // Add versions if present (versioned product - navigation lives in version files)
    if (productFile.versions && productFile.versions.length > 0) {
        doc.versions = productFile.versions.map(versionToObject);
    }

    // Add tab definitions if present
    if (productFile.tabs && Object.keys(productFile.tabs).length > 0) {
        doc.tabs = tabDefinitionsToObject(productFile.tabs);
    }

    // Add navigation (skip if empty - versioned products have navigation in version files)
    if (productFile.navigation.length > 0) {
        doc.navigation = productFile.navigation.map(navigationItemToObject);
    }

    // Generate YAML
    return stringify(doc, {
        indent: 2,
        lineWidth: 120
    });
}

/**
 * Extracts a title from the navigation structure.
 * Looks for root-level pages or the first product name.
 */
export function extractTitle(navigation: FernNavigation): string | undefined {
    // Check for products
    if (navigation.products && navigation.products.length > 0 && navigation.products[0]) {
        return navigation.products[0].displayName;
    }

    // Look for a root page title
    if (navigation.navigation) {
        for (const item of navigation.navigation) {
            if (item.page) {
                return item.page;
            }
            if (item.section) {
                return item.section;
            }
        }
    }

    return undefined;
}
