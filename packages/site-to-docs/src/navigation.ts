import type {
    ContextOrdering,
    CrawlResult,
    FernNavigation,
    FernNavigationItem,
    FernProduct,
    FernProductFile,
    FernTabDefinition,
    FernVersion,
    PageNode,
    SiteStructure
} from "./types.js";

/**
 * Result of analyzing the structure of crawled pages.
 */
interface StructureAnalysis {
    /** Unique product names found */
    products: string[];
    /** Unique version identifiers found */
    versions: string[];
    /** Unique tab names found */
    tabs: string[];
    /** Whether any pages are API references */
    hasApiReference: boolean;
}

/**
 * Analyzes the structure of crawled pages to determine what navigation elements are needed.
 */
function analyzeStructure(pages: Map<string, PageNode>): StructureAnalysis {
    const products = new Set<string>();
    const versions = new Set<string>();
    const tabs = new Set<string>();
    let hasApiReference = false;

    for (const page of pages.values()) {
        const classification = page.classification;
        if (!classification) {
            continue;
        }

        if (classification.product) {
            products.add(classification.product);
        }
        if (classification.version) {
            versions.add(classification.version);
        }
        if (classification.tab) {
            tabs.add(classification.tab);
        }
        if (classification.isApiReference) {
            hasApiReference = true;
        }
    }

    return {
        products: Array.from(products).sort(),
        versions: Array.from(versions).sort(),
        tabs: Array.from(tabs).sort(),
        hasApiReference
    };
}

/**
 * Groups pages by their classification hierarchy.
 */
interface PagesByHierarchy {
    /** Pages grouped by product → version → tab → section */
    byProduct: Map<string, Map<string, Map<string, Map<string, PageNode[]>>>>;
    /** Pages without product (global) */
    global: Map<string, Map<string, Map<string, PageNode[]>>>;
}

/**
 * Groups pages by their product, version, tab, and section.
 */
function groupPagesByHierarchy(pages: Map<string, PageNode>): PagesByHierarchy {
    const byProduct = new Map<string, Map<string, Map<string, Map<string, PageNode[]>>>>();
    const global = new Map<string, Map<string, Map<string, PageNode[]>>>();

    for (const page of pages.values()) {
        const classification = page.classification;
        if (!classification) {
            continue;
        }

        // Skip API reference pages - they get their own section
        if (classification.isApiReference) {
            continue;
        }

        const product = classification.product ?? "";
        const version = classification.version ?? "";
        const tab = classification.tab ?? "";
        const section = classification.section ?? "General";

        // Get or create the nested maps
        if (product && !byProduct.has(product)) {
            byProduct.set(product, new Map());
        }

        const productMap = product ? byProduct.get(product)! : global;

        if (!productMap.has(version)) {
            productMap.set(version, new Map());
        }
        const versionMap = productMap.get(version)!;

        if (!versionMap.has(tab)) {
            versionMap.set(tab, new Map());
        }
        const tabMap = versionMap.get(tab)!;

        if (!tabMap.has(section)) {
            tabMap.set(section, []);
        }
        tabMap.get(section)!.push(page);
    }

    return { byProduct, global };
}

/**
 * Builds a context key from product, version, and tab.
 * Format: "product:version:tab" or "" for simple sites.
 */
function buildContextKey(product?: string, version?: string, tab?: string): string {
    const parts = [product ?? "", version ?? "", tab ?? ""];
    // If all empty, return empty string for simple sites
    if (parts.every((p) => p === "")) {
        return "";
    }
    return parts.join(":");
}

/**
 * Looks up the ordered URLs for a given context from contextOrderings.
 * Falls back to more general contexts if exact match not found.
 */
function getOrderedUrlsForContext(
    contextOrderings: ContextOrdering[],
    product?: string,
    version?: string,
    tab?: string
): string[] {
    // Try exact match first
    const exactKey = buildContextKey(product, version, tab);
    const exactMatch = contextOrderings.find((co) => co.contextKey === exactKey);
    if (exactMatch && exactMatch.orderedUrls.length > 0) {
        return exactMatch.orderedUrls;
    }

    // Try without tab
    const noTabKey = buildContextKey(product, version);
    const noTabMatch = contextOrderings.find((co) => co.contextKey === noTabKey);
    if (noTabMatch && noTabMatch.orderedUrls.length > 0) {
        return noTabMatch.orderedUrls;
    }

    // Try without version
    const noVersionKey = buildContextKey(product);
    const noVersionMatch = contextOrderings.find((co) => co.contextKey === noVersionKey);
    if (noVersionMatch && noVersionMatch.orderedUrls.length > 0) {
        return noVersionMatch.orderedUrls;
    }

    // Try global ordering (empty key)
    const globalMatch = contextOrderings.find((co) => co.contextKey === "");
    if (globalMatch && globalMatch.orderedUrls.length > 0) {
        return globalMatch.orderedUrls;
    }

    return [];
}

/**
 * Extracts the pathname from a URL for comparison.
 * Handles both full URLs and already-pathname strings.
 */
function extractPathname(url: string): string {
    try {
        return new URL(url).pathname;
    } catch {
        // Already a pathname or invalid URL
        return url;
    }
}

/**
 * Builds a URL to order index map for efficient sorting.
 * Normalizes URLs to pathnames for consistent matching.
 */
function buildUrlOrderMap(orderedUrls: string[]): Map<string, number> {
    const map = new Map<string, number>();
    for (let i = 0; i < orderedUrls.length; i++) {
        const url = orderedUrls[i];
        if (url) {
            // Store as pathname for consistent matching
            map.set(extractPathname(url), i);
        }
    }
    return map;
}

/**
 * Creates a navigation item for a page.
 * @param page - The page node
 * @param pathPrefix - Prefix for paths (e.g., "../" for docs.yml in fern/, "../../" for product files in fern/products/)
 */
function createPageItem(page: PageNode, pathPrefix: string = "../"): FernNavigationItem {
    return {
        page: page.title,
        path: `${pathPrefix}${page.fernFilename}`,
        slug: page.fernSlug
    };
}

/**
 * Creates navigation items for a section containing pages.
 * Handles empty sections and unwraps single-page sections.
 * @param sectionMap - Map of section name to pages
 * @param pathPrefix - Prefix for paths (e.g., "../" for docs.yml in fern/, "../../" for product files in fern/products/)
 * @param urlOrderMap - Map of URL pathname to sort order (from LLM contextOrderings)
 */
function createSectionItems(
    sectionMap: Map<string, PageNode[]>,
    pathPrefix: string,
    urlOrderMap: Map<string, number>
): FernNavigationItem[] {
    const items: FernNavigationItem[] = [];

    for (const [sectionName, pages] of sectionMap) {
        // Sort pages by LLM ordering, then alphabetically by slug
        const sortedPages = pages.sort((a, b) => {
            // Check LLM-provided ordering (normalize URL to pathname for matching)
            const aOrder = urlOrderMap.get(extractPathname(a.url));
            const bOrder = urlOrderMap.get(extractPathname(b.url));

            // Both have ordering: use that
            if (aOrder !== undefined && bOrder !== undefined) {
                return aOrder - bOrder;
            }
            // Only one has ordering: ordered pages come first
            if (aOrder !== undefined) {
                return -1;
            }
            if (bOrder !== undefined) {
                return 1;
            }

            // Neither has ordering: alphabetical fallback
            return a.slug.localeCompare(b.slug);
        });

        if (sortedPages.length === 0) {
            // Empty section - skip
            continue;
        }

        // Empty section name or single page - add pages directly without section wrapper
        if (!sectionName || sectionName === "" || sortedPages.length === 1) {
            for (const page of sortedPages) {
                items.push(createPageItem(page, pathPrefix));
            }
        } else {
            // Multiple pages in named section - create section wrapper
            items.push({
                section: sectionName,
                contents: sortedPages.map((p) => createPageItem(p, pathPrefix))
            });
        }
    }

    return items;
}

/**
 * Creates navigation items for tabs containing sections.
 * @param pathPrefix - Prefix for paths (e.g., "../" for docs.yml in fern/, "../../" for product files in fern/products/)
 * @param urlOrderMap - Map of URL pathname to sort order (from LLM contextOrderings)
 */
function createTabNavigation(
    tabMap: Map<string, Map<string, PageNode[]>>,
    tabs: string[],
    hasApiReference: boolean,
    pathPrefix: string,
    urlOrderMap: Map<string, number>
): { tabDefinitions: Record<string, FernTabDefinition>; navigation: FernNavigationItem[] } {
    const tabDefinitions: Record<string, FernTabDefinition> = {};
    const navigation: FernNavigationItem[] = [];

    for (const tabName of tabs) {
        const tabSlug = tabName.toLowerCase().replace(/\s+/g, "-");
        const sectionMap = tabMap.get(tabName);

        tabDefinitions[tabSlug] = {
            displayName: tabName
        };

        const tabContent: FernNavigationItem[] = [];

        if (sectionMap) {
            tabContent.push(...createSectionItems(sectionMap, pathPrefix, urlOrderMap));
        }

        // Add API reference to appropriate tab (usually "API Reference" or "API")
        if (hasApiReference && (tabName.toLowerCase().includes("api") || tabName.toLowerCase().includes("reference"))) {
            tabContent.push({ api: "API Reference" });
        }

        navigation.push({
            tab: tabSlug,
            layout: tabContent
        });
    }

    // If no API tab found but we have API references, add them to the end
    if (hasApiReference && !tabs.some((t) => t.toLowerCase().includes("api"))) {
        const apiTabSlug = "api-reference";
        tabDefinitions[apiTabSlug] = { displayName: "API Reference" };
        navigation.push({
            tab: apiTabSlug,
            layout: [{ api: "API Reference" }]
        });
    }

    return { tabDefinitions, navigation };
}

/**
 * Creates simple navigation (no tabs) from sections.
 * @param pathPrefix - Prefix for paths (e.g., "../" for docs.yml in fern/, "../../" for product files in fern/products/)
 * @param urlOrderMap - Map of URL pathname to sort order (from LLM contextOrderings)
 */
function createSimpleNavigation(
    sectionMap: Map<string, PageNode[]>,
    hasApiReference: boolean,
    pathPrefix: string,
    urlOrderMap: Map<string, number>
): FernNavigationItem[] {
    const items = createSectionItems(sectionMap, pathPrefix, urlOrderMap);

    if (hasApiReference) {
        items.push({ api: "API Reference" });
    }

    return items;
}

/**
 * Builds Fern navigation for a single version (or unversioned content).
 * Tabs are derived from actual page content - only creates tab structure if 2+ tabs have content.
 * @param pathPrefix - Prefix for paths (e.g., "../" for docs.yml in fern/, "../../" for product files in fern/products/)
 * @param urlOrderMap - Map of URL pathname to sort order (from LLM contextOrderings)
 */
function buildVersionNavigation(
    versionMap: Map<string, Map<string, PageNode[]>>,
    hasApiReference: boolean,
    pathPrefix: string,
    urlOrderMap: Map<string, number>
): { tabs?: Record<string, FernTabDefinition>; navigation: FernNavigationItem[] } {
    // Derive tabs from actual content in this version (emergent tabs)
    // Filter out empty string tab (pages with no tab assignment)
    const actualTabs = Array.from(versionMap.keys()).filter((t) => t && t !== "");

    // Only use tab structure if there are 2+ actual tabs with content
    if (actualTabs.length >= 2) {
        const { tabDefinitions, navigation } = createTabNavigation(
            versionMap,
            actualTabs,
            hasApiReference,
            pathPrefix,
            urlOrderMap
        );
        return { tabs: tabDefinitions, navigation };
    }

    // No tabs or single tab - use simple navigation (flatten all content)
    const allSections = new Map<string, PageNode[]>();
    for (const sectionMap of versionMap.values()) {
        for (const [section, pages] of sectionMap) {
            const existing = allSections.get(section) ?? [];
            allSections.set(section, [...existing, ...pages]);
        }
    }

    return { navigation: createSimpleNavigation(allSections, hasApiReference, pathPrefix, urlOrderMap) };
}

/**
 * Result of building product navigation - includes the product definition
 * and the content for its separate .yml file, plus any version files.
 */
interface ProductNavigationResult {
    /** Product definition for docs.yml (with path reference) */
    product: FernProduct;
    /** Content for the product's separate .yml file (undefined when using versions) */
    fileContent?: FernProductFile;
    /** Version files to write (path -> content), e.g., "products/platform/v1.yml" -> {...} */
    versionFiles?: Map<string, FernProductFile>;
}

/**
 * Builds Fern navigation for a product.
 * Fern requires products to have a separate .yml file referenced via the `path` property.
 * This returns both the product definition and the content for its separate file.
 *
 * For versions, Fern requires separate files. When multiple versions exist, we generate:
 * - Product file (e.g., products/platform.yml) with versions array
 * - Version files (e.g., products/platform/v1.yml) with navigation for each version
 */
/**
 * Checks if any pages with the given product/version have API references.
 * Note: API reference pages are excluded from grouping, so we need to check the original pages.
 */
function hasApiReferenceForContext(pages: Map<string, PageNode>, product?: string, version?: string): boolean {
    for (const page of pages.values()) {
        if (!page.classification?.isApiReference) {
            continue;
        }
        // Check if this API reference page belongs to the requested product/version
        const pageProduct = page.classification.product ?? "";
        const pageVersion = page.classification.version ?? "";

        if (product !== undefined && pageProduct !== product) {
            continue;
        }
        if (version !== undefined && pageVersion !== version) {
            continue;
        }
        return true;
    }
    return false;
}

function buildProductNavigation(
    productMap: Map<string, Map<string, Map<string, PageNode[]>>>,
    versions: string[],
    productSlug: string,
    productName: string,
    allPages: Map<string, PageNode>,
    contextOrderings: ContextOrdering[]
): ProductNavigationResult {
    // Check which versions actually have content for this product
    const nonEmptyVersions = versions.filter((v) => productMap.has(v));

    // Multiple versions - generate separate version files
    // Fern structure: product.path = default version file, product.versions[] = all version files
    if (nonEmptyVersions.length > 1) {
        const versionFiles = new Map<string, FernProductFile>();
        const versionDefinitions: FernVersion[] = [];

        for (const versionName of nonEmptyVersions) {
            const versionMap = productMap.get(versionName)!;
            const versionSlug = versionName.toLowerCase().replace(/\s+/g, "-");

            // Version files are in fern/products/{product}/, paths need "../../../" to reach pages/
            // fern/products/platform/ -> ../ -> fern/products/ -> ../ -> fern/ -> ../ -> output/ -> pages/
            const versionPathPrefix = "../../../";

            // Get ordering for this product/version context
            const orderedUrls = getOrderedUrlsForContext(contextOrderings, productName, versionName);
            const urlOrderMap = buildUrlOrderMap(orderedUrls);

            // Build navigation for this version (tabs emergent, API ref from original pages)
            const hasApiRef = hasApiReferenceForContext(allPages, productName, versionName);
            const { tabs: tabDefs, navigation } = buildVersionNavigation(
                versionMap,
                hasApiRef,
                versionPathPrefix,
                urlOrderMap
            );

            // Create version file content
            const versionFileContent: FernProductFile = {
                tabs: tabDefs,
                navigation
            };

            // Store version file at products/{product}/{version}.yml
            const versionFilePath = `products/${productSlug}/${versionSlug}.yml`;
            versionFiles.set(versionFilePath, versionFileContent);

            // Add version definition
            versionDefinitions.push({
                displayName: versionName,
                slug: versionSlug,
                path: `./products/${productSlug}/${versionSlug}.yml`
            });
        }

        // Product path points to the DEFAULT version file (first one)
        const defaultVersionSlug = nonEmptyVersions[0]!.toLowerCase().replace(/\s+/g, "-");
        const defaultVersionPath = `./products/${productSlug}/${defaultVersionSlug}.yml`;

        const product: FernProduct = {
            displayName: "", // Will be set by caller
            slug: productSlug,
            path: defaultVersionPath,
            versions: versionDefinitions
        };

        // No separate product file needed - product.path points directly to default version
        return { product, fileContent: undefined, versionFiles };
    }

    // No versions or single version - use direct navigation in product file
    // Product files are in products/, so paths need "../../" to reach pages/
    const pathPrefix = "../../";

    const allVersionData = new Map<string, Map<string, PageNode[]>>();
    for (const versionMap of productMap.values()) {
        for (const [tab, sectionMap] of versionMap) {
            if (!allVersionData.has(tab)) {
                allVersionData.set(tab, new Map());
            }
            for (const [section, pages] of sectionMap) {
                const existing = allVersionData.get(tab)!.get(section) ?? [];
                allVersionData.get(tab)!.set(section, [...existing, ...pages]);
            }
        }
    }

    // Get ordering for this product context
    const orderedUrls = getOrderedUrlsForContext(contextOrderings, productName);
    const urlOrderMap = buildUrlOrderMap(orderedUrls);

    // Check for API references in this product (from original pages)
    const hasApiRef = hasApiReferenceForContext(allPages, productName);
    const { tabs: tabDefs, navigation } = buildVersionNavigation(allVersionData, hasApiRef, pathPrefix, urlOrderMap);

    const fileContent: FernProductFile = {
        tabs: tabDefs,
        navigation
    };

    // Product definition with path to its separate file
    const product: FernProduct = {
        displayName: "", // Will be set by caller
        slug: productSlug,
        path: `./products/${productSlug}.yml`
    };

    return { product, fileContent };
}

/**
 * Builds the Fern navigation structure from crawl results.
 * This is the main entry point for navigation generation.
 *
 * @param crawlResult - The result from crawling the site
 * @param siteStructure - Optional site structure with contextOrderings from LLM analysis
 * @returns FernNavigation structure for docs.yml, including separate product files
 */
export function buildFernNavigation(crawlResult: CrawlResult, siteStructure?: SiteStructure): FernNavigation {
    const { pages } = crawlResult;
    const structure = analyzeStructure(pages);
    const { byProduct, global } = groupPagesByHierarchy(pages);

    // Get context orderings from site structure (if available)
    const contextOrderings = siteStructure?.contextOrderings ?? [];

    // Case 1: Multiple products - use products structure with separate files
    if (structure.products.length > 1) {
        const products: FernProduct[] = [];
        const productFiles = new Map<string, FernProductFile>();

        for (const productName of structure.products) {
            const productMap = byProduct.get(productName);
            if (!productMap) {
                continue;
            }

            const productSlug = productName.toLowerCase().replace(/\s+/g, "-");
            const { product, fileContent, versionFiles } = buildProductNavigation(
                productMap,
                structure.versions,
                productSlug,
                productName,
                pages,
                contextOrderings
            );
            product.displayName = productName;
            products.push(product);

            // Store the product file content
            if (fileContent) {
                productFiles.set(`products/${productSlug}.yml`, fileContent);
            }

            // Store version files if present
            if (versionFiles) {
                for (const [path, content] of versionFiles) {
                    productFiles.set(path, content);
                }
            }
        }

        return { products, productFiles };
    }

    // Case 2: Single product or no product - check for versions/tabs
    const targetMap = byProduct.size > 0 ? byProduct.values().next().value : global;

    if (!targetMap || targetMap.size === 0) {
        // No pages to process - return empty navigation
        return { navigation: [] };
    }

    // Get the URL order map for the current context (no product for global case)
    const orderedUrls = getOrderedUrlsForContext(contextOrderings);
    const urlOrderMap = buildUrlOrderMap(orderedUrls);

    // Case 3: Multiple versions
    if (structure.versions.length > 1) {
        // Build versioned navigation (would need separate yml files in real impl)
        // For now, we'll flatten into a single navigation with version prefixes
        const allSections = new Map<string, PageNode[]>();
        for (const versionMap of targetMap.values()) {
            for (const tabMap of versionMap.values()) {
                for (const [section, pages] of tabMap) {
                    const existing = allSections.get(section) ?? [];
                    allSections.set(section, [...existing, ...pages]);
                }
            }
        }

        // Check for API references in all pages (no product/version filter)
        const hasApiRefInContent = hasApiReferenceForContext(pages);
        return { navigation: createSimpleNavigation(allSections, hasApiRefInContent, "../", urlOrderMap) };
    }

    // Case 4: Check for tabs (emergent from content)
    const allTabs = new Map<string, Map<string, PageNode[]>>();
    for (const versionMap of targetMap.values()) {
        for (const [tab, sectionMap] of versionMap) {
            if (!allTabs.has(tab)) {
                allTabs.set(tab, new Map());
            }
            for (const [section, pagesInSection] of sectionMap) {
                const existing = allTabs.get(tab)!.get(section) ?? [];
                allTabs.get(tab)!.set(section, [...existing, ...pagesInSection]);
            }
        }
    }

    // Derive tabs from actual content (emergent tabs)
    const actualTabs = Array.from(allTabs.keys()).filter((t) => t && t !== "");
    // Check for API references in all pages (no product/version filter for non-product cases)
    const hasApiRefInContent = hasApiReferenceForContext(pages);
    if (actualTabs.length >= 2) {
        const { tabDefinitions, navigation } = createTabNavigation(
            allTabs,
            actualTabs,
            hasApiRefInContent,
            "../",
            urlOrderMap
        );
        return { tabs: tabDefinitions, navigation };
    }

    // Case 5: Simple navigation (no products, versions, or multiple tabs)
    // Flatten all content into sections
    const allSections = new Map<string, PageNode[]>();
    for (const sectionMap of allTabs.values()) {
        for (const [section, pagesInSection] of sectionMap) {
            const existing = allSections.get(section) ?? [];
            allSections.set(section, [...existing, ...pagesInSection]);
        }
    }

    return { navigation: createSimpleNavigation(allSections, hasApiRefInContent, "../", urlOrderMap) };
}

/**
 * Collects all API reference pages from the crawl result.
 */
export function collectApiReferencePages(pages: Map<string, PageNode>): PageNode[] {
    const apiPages: PageNode[] = [];

    for (const page of pages.values()) {
        if (page.classification?.isApiReference) {
            apiPages.push(page);
        }
    }

    return apiPages.sort((a, b) => a.slug.localeCompare(b.slug));
}
