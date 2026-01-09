/**
 * @fern-api/site-to-docs
 *
 * An AI agent that converts existing documentation websites into Fern documentation projects.
 *
 * @example
 * ```typescript
 * import { runAgent } from "@fern-api/site-to-docs";
 *
 * const result = await runAgent({
 *   url: "https://docs.example.com",
 *   outputDir: "./output",
 * });
 *
 * console.log(`Converted ${result.writtenFiles.length} files`);
 * console.log(`Warnings: ${result.warnings.length}`);
 * ```
 */

export type { ProgressEvent, SiteToDocsOptions } from "./agent.js";
// Agent exports
export { runAgent, testTools, ValidationError } from "./agent.js";
export type { ClassifyPagesOptions, GroupPagesOptions, GroupPagesResult } from "./classifier.js";
// Classifier exports
export {
    aggregateNavigationSignals,
    analyzeSiteStructure,
    buildClassificationPrompt,
    buildSectionClassificationPrompt,
    buildSiteStructurePrompt,
    classifyPages,
    deriveFromStructure,
    detectVersion,
    enforceConsistency,
    extractBreadcrumbPath,
    extractOrderedSidebarLinks,
    extractPageContext,
    extractSiteNavigationLinks,
    extractTextPreview,
    extractUrlPathSegments,
    extractUrlPrefix,
    groupPagesByPrefix,
    inferPageType
} from "./classifier.js";

// Crawler exports
export {
    crawlSite,
    extractCanonicalUrl,
    extractDescription,
    extractLinks,
    extractSlug,
    extractTitle,
    normalizeUrl
} from "./crawler.js";
export type { DocsYmlOptions } from "./docsYml.js";
// docs.yml generation exports
export { extractTitle as extractNavigationTitle, generateDocsYml, generateProductFileYml } from "./docsYml.js";

// Fern config generation exports
export type { FernConfigOptions } from "./fernConfig.js";
export { generateFernConfigJson } from "./fernConfig.js";

// Filename/slug generation exports
export { assignFilenamesAndSlugs, buildUrlToSlugMap, generateFernFilename, generateFernSlug } from "./filenames.js";

// Generators.yml exports
export type { GeneratorsYmlOptions } from "./generatorsYml.js";
export { generateGeneratorsYml } from "./generatorsYml.js";

// Markdown conversion exports
export {
    convertPageToMarkdown,
    extractMainContent,
    generateFrontmatter,
    htmlToMarkdown,
    rewriteInternalLinks
} from "./markdown.js";

// Navigation tree exports
export { buildFernNavigation, collectApiReferencePages } from "./navigation.js";

// OpenAPI stub exports
export { generateEmptyOpenApiStub, generateOpenApiStub } from "./openapi.js";
export type { Tools } from "./tools.js";
// Tool exports (for advanced usage)
export { createTools } from "./tools.js";
// Type exports
export type {
    AggregatedSignals,
    ContextOrdering,
    ConversionResult,
    CrawlOptions,
    CrawlResult,
    DiscoveredProduct,
    DiscoveredTab,
    DiscoveredVersion,
    FernDocsConfig,
    FernNavigation,
    FernNavigationItem,
    FernProduct,
    FernProductFile,
    FernTabDefinition,
    FernVersion,
    OrderedNavLink,
    PageClassification,
    PageContext,
    PageNode,
    PageType,
    SidebarSignal,
    SiteStructure
} from "./types.js";
// Utils exports
export { validateOrganizationName } from "./utils.js";
