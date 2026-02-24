/**
 * Represents a page node in the site graph during crawling and transformation.
 */
export interface PageNode {
    /** The original URL of the page */
    url: string;
    /** URL-derived slug for the page */
    slug: string;
    /** Page title extracted from HTML */
    title: string;
    /** Page description/subtitle extracted from meta description */
    description?: string;
    /** Raw HTML content of the page */
    html: string;
    /** Converted markdown content */
    markdown?: string;
    /** Generated Fern filename (e.g., "getting-started.mdx") */
    fernFilename?: string;
    /** Generated Fern slug for navigation */
    fernSlug?: string;
    /** Classification into Fern ontology */
    classification?: PageClassification;
    /** Child pages linked from this page */
    children: PageNode[];
}

/**
 * Options for the BFS site crawler.
 */
export interface CrawlOptions {
    /** The root URL to start crawling from */
    rootUrl: string;
    /** Maximum number of pages to crawl */
    maxPages: number;
    /** Maximum depth for BFS traversal */
    maxDepth: number;
    /** Optional callback for progress updates */
    onProgress?: (crawled: number, queued: number) => void;
}

/**
 * Result of the site crawl operation.
 */
export interface CrawlResult {
    /** Map of URL to PageNode */
    pages: Map<string, PageNode>;
    /** Map of URL to array of URLs it links to (edges in the graph) */
    edges: Map<string, string[]>;
    /** Map of URL to array of URLs that link to it (reverse edges) */
    backlinks: Map<string, string[]>;
    /** Warnings generated during crawling */
    warnings: string[];
    /** The root URL that was used to start the crawl */
    rootUrl: string;
}

/**
 * Classification of a page into the Fern documentation ontology.
 */
export interface PageClassification {
    /** Product name (for multi-product docs) */
    product?: string;
    /** Version identifier (for versioned docs) */
    version?: string;
    /** Tab name within the docs */
    tab?: string;
    /** Section name for grouping pages */
    section?: string;
    /** Whether this page is an API reference page */
    isApiReference: boolean;
}

// ============================================================================
// Fern docs.yml Navigation Types
// These types mirror the Fern docs.yml configuration structure exactly.
// See: https://buildwithfern.com/learn/docs/configuration/navigation
// ============================================================================

/**
 * Root Fern navigation structure.
 * Supports three modes:
 * 1. Simple: Just navigation[] (no products/tabs)
 * 2. Tabs: tabs{} definition + navigation[] with tab references
 * 3. Products: products[] with separate .yml files per product
 */
export interface FernNavigation {
    /** Product definitions (for multi-product docs) */
    products?: FernProduct[];
    /** Tab definitions (for tabbed docs without products) */
    tabs?: Record<string, FernTabDefinition>;
    /** Navigation items (simple mode or with tab references) */
    navigation?: FernNavigationItem[];
    /** Separate product files to write (path -> content) */
    productFiles?: Map<string, FernProductFile>;
}

/**
 * Content for a product-specific .yml file.
 * This is what goes inside each product's separate .yml file.
 */
export interface FernProductFile {
    /** Version definitions for this product (if versioned) */
    versions?: FernVersion[];
    /** Tab definitions for this product */
    tabs?: Record<string, FernTabDefinition>;
    /** Navigation items for this product */
    navigation: FernNavigationItem[];
}

/**
 * Product definition in Fern docs.yml
 * Note: Products require either a `path` to a separate .yml file or an `href` for external products.
 * Inline navigation/tabs inside products is not supported by Fern.
 */
export interface FernProduct {
    /** Display name shown in product selector */
    displayName: string;
    /** URL slug for this product */
    slug: string;
    /** Path to product-specific .yml file (required for internal products) */
    path?: string;
    /** External link (for products hosted elsewhere) */
    href?: string;
    /** Icon for product selector */
    icon?: string;
    /** Subtitle shown in product switcher */
    subtitle?: string;
    /** Versions within this product (each version also needs a path) */
    versions?: FernVersion[];
}

/**
 * Version definition in Fern docs.yml
 * Note: Fern requires each version to have a `path` to a separate .yml file.
 * Inline navigation/tabs inside versions is not supported by Fern.
 */
export interface FernVersion {
    /** Display name shown in version selector */
    displayName: string;
    /** URL slug for this version */
    slug: string;
    /** Path to version-specific .yml file (required for versions) */
    path: string;
    /** Version availability: deprecated, ga, stable, or beta */
    availability?: "deprecated" | "ga" | "stable" | "beta";
}

/**
 * Tab definition in Fern docs.yml
 */
export interface FernTabDefinition {
    /** Display name shown in tab bar */
    displayName: string;
    /** Font Awesome icon (e.g., "fa-solid fa-book") */
    icon?: string;
}

/**
 * Navigation item in Fern docs.yml
 * Can be: section, page, api reference, link, or tab layout
 */
export interface FernNavigationItem {
    // Section with nested contents
    /** Section title */
    section?: string;
    /** Nested items within section */
    contents?: FernNavigationItem[];
    /** Section overview page path */
    path?: string;
    /** @deprecated Use `collapsible` and `collapsedByDefault` instead. */
    collapsed?: boolean;
    /** Whether section can be expanded/collapsed by the user */
    collapsible?: boolean;
    /** Whether section starts collapsed (only meaningful when collapsible is true) */
    collapsedByDefault?: boolean;
    /** Font Awesome icon */
    icon?: string;

    // Page reference
    /** Page display name */
    page?: string;
    /** Custom URL slug (optional) */
    slug?: string;
    // path is shared with section

    // API reference
    /** API reference name (generates from OpenAPI) */
    api?: string;

    // External link
    /** Link display text */
    link?: string;
    /** Link URL */
    href?: string;

    // Tab layout (when using tabs)
    /** Tab identifier (references tabs definition) */
    tab?: string;
    /** Layout within this tab */
    layout?: FernNavigationItem[];
}

/**
 * Legacy simple config structure (kept for backwards compatibility)
 */
export interface FernDocsConfig {
    /** Navigation structure for the documentation */
    navigation: FernNavigationItem[];
}

/**
 * Result of the site-to-docs conversion process.
 */
export interface ConversionResult {
    /** Root of the page tree */
    pageTree: PageNode;
    /** Generated docs.yml configuration */
    docsConfig: FernDocsConfig;
    /** List of files written to the output directory */
    writtenFiles: string[];
    /** Any warnings or issues encountered */
    warnings: string[];
}

// ============================================================================
// Navigation Structure Extraction
// Types for preserving page/section order extracted from HTML navigation.
// ============================================================================

/**
 * Navigation structure hints extracted from HTML.
 * These are heuristics - the LLM may choose to deviate from them.
 */
export interface NavigationHints {
    /** Sections in their intended display order */
    sections: string[];
    /** Page URLs per section, in their intended display order */
    pagesBySection: Map<string, string[]>;
}

/**
 * Result of extracting navigation structure from HTML.
 * Includes both the URL-to-section mapping and navigation hints.
 */
export interface NavigationExtractionResult {
    /** Map of URL pathname to section name (for quick lookup) */
    urlToSection: Map<string, string>;
    /** Navigation structure hints for LLM ordering */
    hints: NavigationHints;
}

// ============================================================================
// Site Structure Types (Phase 1 Output)
// These types capture the global structure discovered by analyzing all URLs
// and navigation signals from the entire site.
// ============================================================================

/**
 * Represents the page ordering for a specific navigation context.
 * A context is defined by the combination of product, version, and tab.
 */
export interface ContextOrdering {
    /** Context identifier: "product:version:tab" or "" for simple sites */
    contextKey: string;
    /** URLs in the intended navigation order for this context */
    orderedUrls: string[];
}

/**
 * Represents a product (separate documentation area) discovered in the site.
 */
export interface DiscoveredProduct {
    /** Product name (e.g., "Platform", "CLI") */
    name: string;
    /** URL path prefix that identifies this product (e.g., "platform", "cli") */
    urlPrefix: string;
}

/**
 * Represents a version discovered in the site.
 */
export interface DiscoveredVersion {
    /** Version identifier (e.g., "v1", "v2") */
    name: string;
    /** URL pattern that identifies this version (e.g., "v-1", "v1") */
    urlPattern: string;
}

/**
 * Represents a tab (major navigation category) discovered in the site.
 */
export interface DiscoveredTab {
    /** Tab name (e.g., "Guides", "API Reference") */
    name: string;
    /** URL pattern or keyword that identifies this tab */
    urlPattern?: string;
    /** Font Awesome icon name (e.g., "book", "code", "puzzle") */
    icon?: string;
}

/**
 * Site structure discovered by Phase 1 analysis.
 * Captures the high-level organization of the documentation site.
 */
export interface SiteStructure {
    /** Products found (separate doc areas like "Platform" vs "CLI") */
    products: DiscoveredProduct[];
    /** Versions found (e.g., "v1", "v2") */
    versions: DiscoveredVersion[];
    /** Tabs found (major nav categories like "Guides", "API Reference") */
    tabs: DiscoveredTab[];
    /** LLM-decided page orderings per navigation context */
    contextOrderings: ContextOrdering[];
    /** Section names in their intended display order (from HTML navigation hints) */
    sectionOrder?: string[];
}

// ============================================================================
// Page Context for Classification
// These types are used by the classifier to provide rich signals per page.
// ============================================================================

/**
 * Rich context extracted from a page for classification.
 * Combines URL-derived and HTML-derived signals to give the LLM
 * comprehensive information for accurate classification.
 */
export interface PageContext {
    // === URL-derived signals ===
    /** The full URL of the page */
    url: string;
    /** URL path split into segments: ["platform", "guides", "overview"] */
    urlPathSegments: string[];

    // === HTML-derived: Basic metadata ===
    /** Page title from <title> or <h1> */
    pageTitle: string;
    /** Page description from meta description tag */
    pageDescription?: string;

    // === HTML-derived: Navigation section ===
    /** Section name extracted from navigation (e.g., "Tutorials", "Capabilities") */
    navSection?: string;

    // === Content preview ===
    /** Truncated text content for LLM context */
    contentSnippet: string;
}

// ============================================================================
// Site Branding Types
// Types for extracted logo and color information from the site.
// ============================================================================

/**
 * Logo configuration extracted from a site.
 */
export interface SiteLogo {
    /** URL to link to when logo is clicked (typically the site root) */
    href?: string;
    /** Path to light mode logo image */
    light?: string;
    /** Path to dark mode logo image */
    dark?: string;
}

/**
 * Accent color configuration with light and dark mode variants.
 */
export interface AccentColor {
    /** Hex color for light mode (e.g., "#635BFF") */
    light?: string;
    /** Hex color for dark mode (e.g., "#9B90FF") */
    dark?: string;
}

/**
 * Site branding information extracted from HTML.
 * Used to configure logo and colors in generated docs.yml.
 */
export interface SiteBranding {
    /** Logo configuration */
    logo?: SiteLogo;
    /** Path to favicon */
    favicon?: string;
    /** Primary accent color for the site */
    accentColor?: AccentColor;
}
