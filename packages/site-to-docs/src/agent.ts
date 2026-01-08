import { execSync } from "node:child_process";
import * as crypto from "node:crypto";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { anthropic } from "@ai-sdk/anthropic";

import { classifyPages } from "./classifier.js";
import { crawlSite, normalizeUrl } from "./crawler.js";
import { generateDocsYml, generateProductFileYml } from "./docsYml.js";
import { generateFernConfigJson } from "./fernConfig.js";
import { assignFilenamesAndSlugs, buildUrlToSlugMap } from "./filenames.js";
import { generateGeneratorsYml } from "./generatorsYml.js";
import { convertPageToMarkdown } from "./markdown.js";
import { buildFernNavigation, collectApiReferencePages } from "./navigation.js";
import { generateEmptyOpenApiStub, generateOpenApiStub } from "./openapi.js";
import { createTools } from "./tools.js";
import type { ConversionResult, CrawlResult, FernDocsConfig, PageNode } from "./types.js";

/**
 * Custom error for expected/validation errors.
 * These can be shown cleanly (e.g. in the CLI) without stack traces.
 */
export class ValidationError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "ValidationError";
    }
}

/**
 * Serializable format for CrawlResult (Maps converted to arrays).
 */
interface SerializedCrawlResult {
    pages: Array<[string, PageNode]>;
    edges: Array<[string, string[]]>;
    backlinks: Array<[string, string[]]>;
    warnings: string[];
    rootUrl: string;
}

/**
 * Generates a cache key from a URL for use as a filename.
 */
function getCacheKey(url: string, prefix: string = "crawl"): string {
    const normalized = normalizeUrl(url);
    const hash = crypto.createHash("sha256").update(normalized).digest("hex").slice(0, 12);
    const hostname = new URL(normalized).hostname.replace(/\./g, "-");
    return `${prefix}-${hostname}-${hash}.json`;
}

/**
 * Serializes a CrawlResult for JSON storage (converts Maps to arrays).
 */
function serializeCrawlResult(result: CrawlResult): SerializedCrawlResult {
    return {
        pages: Array.from(result.pages.entries()),
        edges: Array.from(result.edges.entries()),
        backlinks: Array.from(result.backlinks.entries()),
        warnings: result.warnings,
        rootUrl: result.rootUrl
    };
}

/**
 * Deserializes a CrawlResult from JSON storage (converts arrays back to Maps).
 */
function deserializeCrawlResult(data: SerializedCrawlResult): CrawlResult {
    return {
        pages: new Map(data.pages),
        edges: new Map(data.edges),
        backlinks: new Map(data.backlinks),
        warnings: data.warnings,
        rootUrl: data.rootUrl
    };
}

/**
 * Loads cached crawl result if it exists.
 */
async function loadCrawlCache(cacheDir: string, url: string, prefix: string = "crawl"): Promise<CrawlResult | null> {
    const cacheKey = getCacheKey(url, prefix);
    const cachePath = path.join(cacheDir, cacheKey);
    try {
        const data = await fs.readFile(cachePath, "utf-8");
        const parsed = JSON.parse(data) as SerializedCrawlResult;
        return deserializeCrawlResult(parsed);
    } catch {
        return null;
    }
}

/**
 * Saves crawl result to cache.
 */
async function saveCrawlCache(
    cacheDir: string,
    url: string,
    result: CrawlResult,
    prefix: string = "crawl"
): Promise<void> {
    await fs.mkdir(cacheDir, { recursive: true });
    const cacheKey = getCacheKey(url, prefix);
    const cachePath = path.join(cacheDir, cacheKey);
    const serialized = serializeCrawlResult(result);
    await fs.writeFile(cachePath, JSON.stringify(serialized, null, 2), "utf-8");
}

/**
 * Configuration options for running the site-to-docs agent.
 */
export interface SiteToDocsOptions {
    /** The root URL to start crawling from */
    url: string;
    /** Output directory for generated files */
    outputDir: string;
    /** Organization name for Fern config */
    organization: string;
    /** Site ID for docs instance URL */
    siteId: string;
    /** Maximum number of pages to crawl (default: 128) */
    maxPages?: number;
    /** Maximum depth for BFS crawling (default: 8) */
    maxDepth?: number;
    /** Maximum pages per classification batch (default: 16) */
    maxGroupSize?: number;
    /** Whether to run in verbose mode */
    verbose?: boolean;
    /** Title for the documentation site */
    title?: string;
    /** Use cached crawler results if available (useful for development) */
    crawlerCache?: boolean;
    /** Use cached classifier results if available (useful for development) */
    classifierCache?: boolean;
}

/**
 * Run the site-to-docs agent to convert a website into a Fern documentation project.
 *
 * @param options - Configuration options for the agent
 * @returns The result of the conversion process
 *
 * @example
 * ```typescript
 * const result = await runAgent({
 *   url: "https://docs.example.com",
 *   outputDir: "./output",
 * });
 * console.log(`Converted ${result.writtenFiles.length} files`);
 * ```
 */
export async function runAgent(options: SiteToDocsOptions): Promise<ConversionResult> {
    const {
        url,
        outputDir,
        organization,
        siteId,
        maxPages = 128,
        maxDepth = 8,
        maxGroupSize = 16,
        verbose = false,
        title,
        crawlerCache = false,
        classifierCache = false
    } = options;

    // Validate cache flag combination
    if (classifierCache && !crawlerCache) {
        throw new ValidationError("--classifier-cache requires --crawler-cache to avoid mismatched data");
    }

    const log = (msg: string) => {
        if (verbose) {
            console.log(msg);
        }
    };

    const warnings: string[] = [];
    const writtenFiles: string[] = [];

    log(`Starting site-to-docs agent`);
    log(`  URL: ${url}`);
    log(`  Output: ${outputDir}`);
    log(`  Max pages: ${maxPages}`);
    log(`  Max depth: ${maxDepth}`);
    log(`  Max group size: ${maxGroupSize}`);

    // Step 1: Crawl the site using BFS (or load from cache if --crawler-cache)
    log("\n[Step 1] Crawling site...");
    // Cache directory is a sibling of output dir (not inside it) so it survives output clearing
    const cacheDir = path.join(path.dirname(path.resolve(outputDir)), ".cache");
    let crawlResult: CrawlResult;

    if (crawlerCache) {
        const cached = await loadCrawlCache(cacheDir, url);
        if (cached) {
            crawlResult = cached;
            log(`  Loaded ${crawlResult.pages.size} pages from cache`);
        } else {
            crawlResult = await crawlSite({
                rootUrl: url,
                maxPages,
                maxDepth,
                onProgress: (crawled, queued) => {
                    log(`  Crawled ${crawled} pages, ${queued} in queue`);
                }
            });
            await saveCrawlCache(cacheDir, url, crawlResult);
            log(`  Crawl complete: ${crawlResult.pages.size} pages found (cached for next run)`);
        }
    } else {
        crawlResult = await crawlSite({
            rootUrl: url,
            maxPages,
            maxDepth,
            onProgress: (crawled, queued) => {
                log(`  Crawled ${crawled} pages, ${queued} in queue`);
            }
        });
        log(`  Crawl complete: ${crawlResult.pages.size} pages found`);
    }

    // Add any crawl warnings
    warnings.push(...crawlResult.warnings);

    if (crawlResult.pages.size === 0) {
        throw new Error("No pages were crawled");
    }

    // Step 2: Classify pages using LLM (or load from cache if --classifier-cache)
    log("\n[Step 2] Classifying pages...");

    let siteStructure: import("./types.js").SiteStructure | undefined;

    if (classifierCache) {
        const cachedClassified = await loadCrawlCache(cacheDir, url, "classified");
        if (cachedClassified) {
            // Replace crawlResult with the cached classified version
            crawlResult = cachedClassified;
            log(`  Loaded ${crawlResult.pages.size} classified pages from cache`);
            // Note: siteStructure is not cached, so ordering won't be applied from cache
        } else {
            const model = anthropic("claude-sonnet-4-20250514");
            const classificationResult = await classifyPages(crawlResult, model, {
                concurrency: 3,
                maxGroupSize,
                onProgress: (classified, total) => {
                    log(`  Classified ${classified}/${total} pages`);
                }
            });
            warnings.push(...classificationResult.warnings);
            siteStructure = classificationResult.siteStructure;
            log(
                `  Classification complete (${classificationResult.llmCalls} LLM calls, ${classificationResult.groups} groups)`
            );
            // Save classified result for next run
            await saveCrawlCache(cacheDir, url, crawlResult, "classified");
            log(`  Cached classified pages for next run`);
        }
    } else {
        const model = anthropic("claude-sonnet-4-20250514");
        const classificationResult = await classifyPages(crawlResult, model, {
            concurrency: 3,
            maxGroupSize,
            onProgress: (classified, total) => {
                log(`  Classified ${classified}/${total} pages`);
            }
        });
        warnings.push(...classificationResult.warnings);
        siteStructure = classificationResult.siteStructure;
        log(
            `  Classification complete (${classificationResult.llmCalls} LLM calls, ${classificationResult.groups} groups)`
        );
    }

    // Step 3: Assign filenames and slugs
    log("\n[Step 3] Assigning filenames and slugs...");
    assignFilenamesAndSlugs(crawlResult.pages);
    log(`  Assigned filenames to ${crawlResult.pages.size} pages`);

    // Step 4: Convert HTML to markdown (skip API reference pages - they go to OpenAPI only)
    log("\n[Step 4] Converting HTML to markdown...");
    const urlToSlugMap = buildUrlToSlugMap(crawlResult.pages);
    let converted = 0;
    let skippedApiPages = 0;
    for (const page of crawlResult.pages.values()) {
        // Skip API reference pages - they only contribute to OpenAPI stub
        if (page.classification?.isApiReference) {
            skippedApiPages++;
            continue;
        }
        try {
            await convertPageToMarkdown(page, urlToSlugMap, url);
            converted++;
            if (verbose && converted % 10 === 0) {
                log(`  Converted ${converted}/${crawlResult.pages.size - skippedApiPages} pages`);
            }
        } catch (error) {
            warnings.push(
                `Failed to convert page ${page.url}: ${error instanceof Error ? error.message : String(error)}`
            );
        }
    }
    log(`  Converted ${converted} pages to markdown (skipped ${skippedApiPages} API reference pages)`);

    // Step 5: Build Fern navigation tree
    log("\n[Step 5] Building navigation tree...");
    const fernNavigation = buildFernNavigation(crawlResult, siteStructure);
    log(`  Navigation tree built`);

    // Step 6: Write files to output directory
    log("\n[Step 6] Writing files...");

    // Safety: output directory must be inside current working directory
    const cwd = process.cwd();
    const resolvedOutputDir = path.resolve(outputDir);
    if (!resolvedOutputDir.startsWith(cwd + path.sep) && resolvedOutputDir !== cwd) {
        throw new Error(`Output directory must be inside current working directory. Got: ${resolvedOutputDir}`);
    }

    // Clear output directory before writing (remove stale files from previous runs)
    await fs.rm(resolvedOutputDir, { recursive: true, force: true });

    // Create output directory structure
    await fs.mkdir(resolvedOutputDir, { recursive: true });
    await fs.mkdir(path.join(resolvedOutputDir, "fern"), { recursive: true });
    await fs.mkdir(path.join(resolvedOutputDir, "pages"), { recursive: true });

    // Write markdown files (skip API reference pages - they only go to OpenAPI)
    for (const page of crawlResult.pages.values()) {
        // Skip API reference pages - they don't get markdown files
        if (page.classification?.isApiReference) {
            continue;
        }
        if (page.markdown && page.fernFilename) {
            const filePath = path.join(resolvedOutputDir, page.fernFilename);

            // Ensure directory exists
            const dir = path.dirname(filePath);
            await fs.mkdir(dir, { recursive: true });

            // Write file
            await fs.writeFile(filePath, page.markdown, "utf-8");
            writtenFiles.push(page.fernFilename);
        }
    }
    log(`  Wrote ${writtenFiles.length} markdown files`);

    // Generate and write fern.config.json
    const siteTitle = title ?? extractSiteTitle(crawlResult.pages);
    const fernConfigJson = generateFernConfigJson({ organization });
    const fernConfigPath = path.join(resolvedOutputDir, "fern", "fern.config.json");
    await fs.writeFile(fernConfigPath, fernConfigJson, "utf-8");
    writtenFiles.push("fern/fern.config.json");
    log(`  Wrote fern.config.json`);

    // Generate and write docs.yml
    const docsYml = generateDocsYml(fernNavigation, {
        title: siteTitle,
        includeSchema: true,
        siteId
    });
    const docsYmlPath = path.join(resolvedOutputDir, "fern", "docs.yml");
    await fs.writeFile(docsYmlPath, docsYml, "utf-8");
    writtenFiles.push("fern/docs.yml");
    log(`  Wrote docs.yml`);

    // Write separate product files if present (includes version files in subdirectories)
    if (fernNavigation.productFiles) {
        for (const [filePath, fileContent] of fernNavigation.productFiles) {
            const productFileYml = generateProductFileYml(fileContent);
            const productFilePath = path.join(resolvedOutputDir, "fern", filePath);
            // Create directory (handles nested paths like products/platform/v1.yml)
            await fs.mkdir(path.dirname(productFilePath), { recursive: true });
            await fs.writeFile(productFilePath, productFileYml, "utf-8");
            writtenFiles.push(`fern/${filePath}`);
            log(`  Wrote ${filePath}`);
        }
    }

    // Generate and write OpenAPI stub if there are API reference pages
    const apiPages = collectApiReferencePages(crawlResult.pages);
    let openApiYml: string;
    if (apiPages.length > 0) {
        openApiYml = generateOpenApiStub(apiPages, {
            title: title ?? "API Reference",
            serverUrl: new URL(url).origin
        });
        log(`  Generated OpenAPI stub from ${apiPages.length} API reference pages`);
    } else {
        openApiYml = generateEmptyOpenApiStub(title ?? "API Reference");
        log(`  Generated empty OpenAPI stub (no API reference pages found)`);
    }
    const openApiPath = path.join(resolvedOutputDir, "fern", "openapi.yml");
    await fs.writeFile(openApiPath, openApiYml, "utf-8");
    writtenFiles.push("fern/openapi.yml");

    // Generate and write generators.yml
    const generatorsYml = generateGeneratorsYml();
    const generatorsPath = path.join(resolvedOutputDir, "fern", "generators.yml");
    await fs.writeFile(generatorsPath, generatorsYml, "utf-8");
    writtenFiles.push("fern/generators.yml");
    log(`  Wrote generators.yml`);

    // Step 7: Validate output with fern generate --docs --preview
    log("\n[Step 7] Validating output with fern generate --docs --preview...");
    const fernDir = path.join(resolvedOutputDir, "fern");
    try {
        execSync("fern generate --docs --preview", {
            cwd: fernDir,
            stdio: verbose ? "inherit" : "pipe"
        });
        log(`  Validation successful!`);
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        warnings.push(`Fern validation failed: ${message}`);
        log(`  Validation failed: ${message}`);
    }

    // Build the page tree for the result
    const pageUrls = Array.from(crawlResult.pages.keys());
    const rootUrl = pageUrls[0]!;
    const rootPage = crawlResult.pages.get(rootUrl)!;
    const pageTree: PageNode = {
        ...rootPage,
        children: Array.from(crawlResult.pages.values()).filter((p) => p.url !== rootUrl)
    };

    // Build the docs config from navigation
    const docsConfig: FernDocsConfig = {
        navigation: fernNavigation.navigation ?? []
    };

    return {
        pageTree,
        docsConfig,
        writtenFiles,
        warnings
    };
}

/**
 * Extracts a title from the crawled pages (usually from the root page).
 */
function extractSiteTitle(pages: Map<string, PageNode>): string | undefined {
    // Get the first page (root)
    const firstPage = pages.values().next().value;
    if (firstPage?.title) {
        // Clean up common title patterns
        return firstPage.title
            .replace(/\s*\|\s*.*$/, "") // Remove "| Site Name" suffix
            .replace(/\s*-\s*.*$/, "") // Remove "- Site Name" suffix
            .trim();
    }
    return undefined;
}

/**
 * Test function to verify tools are working correctly.
 * Tests fetch (real network call) and filesystem tools (with temp directory).
 */
export async function testTools(url: string, verbose = false): Promise<void> {
    const log = (msg: string) => {
        if (verbose) {
            console.log(msg);
        }
    };

    // Use a temp directory for filesystem tests
    const os = await import("node:os");
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "site-to-docs-test-"));

    try {
        log("\n=== Testing Tools ===\n");

        const tools = createTools(tempDir);

        // Test fetch
        log("Testing fetch tool...");
        const fetchResult = await tools.fetch.execute({ url, method: "GET" }, { toolCallId: "test", messages: [] });
        if (typeof fetchResult.status === "number" && typeof fetchResult.body === "string") {
            log(`  ✓ fetch working: status=${fetchResult.status}, body length=${fetchResult.body.length}`);
        } else {
            throw new Error("fetch returned unexpected result");
        }

        // Test writeFile
        log("Testing writeFile tool...");
        const writeResult = await tools.writeFile.execute(
            { path: "test/hello.md", content: "# Hello World\n\nThis is a test." },
            { toolCallId: "test", messages: [] }
        );
        if (writeResult.success) {
            log(`  ✓ writeFile working: wrote to ${writeResult.path}`);
        } else {
            throw new Error("writeFile failed");
        }

        // Test readFile
        log("Testing readFile tool...");
        const readResult = await tools.readFile.execute(
            { path: "test/hello.md" },
            { toolCallId: "test", messages: [] }
        );
        if (readResult.content.includes("Hello World")) {
            log(`  ✓ readFile working: read ${readResult.content.length} chars`);
        } else {
            throw new Error("readFile returned unexpected content");
        }

        // Test readdir
        log("Testing readdir tool...");
        const readdirResult = await tools.readdir.execute({ path: "test" }, { toolCallId: "test", messages: [] });
        if (readdirResult.entries.some((e) => e.name === "hello.md")) {
            log(`  ✓ readdir working: found ${readdirResult.entries.length} entries`);
        } else {
            throw new Error("readdir did not find expected file");
        }

        // Test path validation (should reject escaping paths)
        log("Testing path validation...");
        try {
            await tools.readFile.execute({ path: "../../../etc/passwd" }, { toolCallId: "test", messages: [] });
            throw new Error("Path validation should have rejected escaping path");
        } catch (e) {
            if (e instanceof Error && e.message.includes("escapes output directory")) {
                log(`  ✓ path validation working: rejected "../../../etc/passwd"`);
            } else {
                throw e;
            }
        }

        // Test absolute path rejection
        try {
            await tools.readFile.execute({ path: "/etc/passwd" }, { toolCallId: "test", messages: [] });
            throw new Error("Path validation should have rejected absolute path");
        } catch (e) {
            if (e instanceof Error && e.message.includes("Absolute paths not allowed")) {
                log(`  ✓ path validation working: rejected "/etc/passwd"`);
            } else {
                throw e;
            }
        }

        log("\n=== All Tools Working ===\n");
    } finally {
        // Cleanup temp directory
        await fs.rm(tempDir, { recursive: true, force: true });
    }
}
