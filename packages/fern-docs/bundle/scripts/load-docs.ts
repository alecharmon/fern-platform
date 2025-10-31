/** biome-ignore-all lint/suspicious/noConsole: script needs console output */
/**
 * Script to load docs definition by domain using FDR SDK (no caching)
 *
 * Usage:
 *   pnpm tsx scripts/load-docs.ts <domain> [--output <file>] [--pretty] [--page <slug>] [--metadata] [--list-pages]
 *
 * Examples:
 *   pnpm tsx scripts/load-docs.ts docs.buildwithfern.com
 *   pnpm tsx scripts/load-docs.ts docs.buildwithfern.com --output output.json
 *   pnpm tsx scripts/load-docs.ts docs.buildwithfern.com --pretty
 *   pnpm tsx scripts/load-docs.ts docs.buildwithfern.com --page docs/features/provider-routing
 *   pnpm tsx scripts/load-docs.ts docs.buildwithfern.com --metadata
 *   pnpm tsx scripts/load-docs.ts docs.buildwithfern.com --list-pages
 */

import { FdrClient } from "@fern-api/fdr-sdk/client";
import { FdrAPI } from "@fern-api/fdr-sdk/client/types";
import * as dotenv from "dotenv";
import * as fs from "fs";
import * as path from "path";

dotenv.config();

interface ScriptOptions {
    domain: string;
    output?: string;
    pretty?: boolean;
    page?: string;
    metadata?: boolean;
    listPages?: boolean;
}

function parseArgs(): ScriptOptions {
    const args = process.argv.slice(2);

    if (args.length === 0 || args.includes("--help") || args.includes("-h")) {
        console.log(`
Usage: pnpm tsx scripts/load-docs.ts <domain> [options]

Arguments:
  domain              The domain to load docs for (e.g., docs.buildwithfern.com)

Options:
  --output, -o <file> Output to file instead of stdout
  --pretty, -p        Pretty-print JSON output
  --page <slug>       Extract and print markdown for a specific page slug
  --metadata          Load metadata instead of full docs definition
  --list-pages        List all pages with their slugs and page IDs
  --help, -h          Show this help message

Examples:
  pnpm tsx scripts/load-docs.ts docs.buildwithfern.com
  pnpm tsx scripts/load-docs.ts docs.buildwithfern.com --output output.json
  pnpm tsx scripts/load-docs.ts docs.buildwithfern.com --pretty
  pnpm tsx scripts/load-docs.ts docs.buildwithfern.com -o output.json -p
  pnpm tsx scripts/load-docs.ts docs.buildwithfern.com --page docs/features/provider-routing
  pnpm tsx scripts/load-docs.ts docs.buildwithfern.com --metadata
  pnpm tsx scripts/load-docs.ts docs.buildwithfern.com --list-pages

Environment Variables:
  FDR_ORIGIN          FDR API origin (default: https://registry.buildwithfern.com)
  FERN_TOKEN          Authentication token for FDR API
        `);
        process.exit(0);
    }

    const domain = args[0];
    if (!domain) {
        console.error("Error: domain is required");
        process.exit(1);
    }

    const options: ScriptOptions = { domain };

    for (let i = 1; i < args.length; i++) {
        const arg = args[i];
        switch (arg) {
            case "--output":
            case "-o":
                options.output = args[++i];
                break;
            case "--pretty":
            case "-p":
                options.pretty = true;
                break;
            case "--page":
                options.page = args[++i];
                break;
            case "--metadata":
                options.metadata = true;
                break;
            case "--list-pages":
                options.listPages = true;
                break;
            default:
                console.error(`Unknown option: ${arg}`);
                process.exit(1);
        }
    }

    return options;
}

async function loadDocsForDomain(domain: string): Promise<FdrAPI.docs.v2.read.LoadDocsForUrlResponse> {
    const fdrOrigin =
        process.env.FDR_ORIGIN ?? process.env.NEXT_PUBLIC_FDR_ORIGIN ?? "https://registry.buildwithfern.com";
    const fernToken = process.env.FERN_TOKEN;

    console.error(`Loading docs for domain: ${domain}`);
    console.error(`Using FDR origin: ${fdrOrigin}`);
    if (fernToken) {
        console.error("Using FERN_TOKEN for authentication");
    } else {
        console.error("No FERN_TOKEN provided (proceeding without authentication)");
    }

    const client = new FdrClient({
        environment: fdrOrigin,
        token: fernToken
    });

    const response = await client.docs.v2.read.getDocsForUrl({
        url: FdrAPI.Url(domain)
    });

    if (!response.ok) {
        console.error("Failed to load docs:");
        console.error(JSON.stringify(response.error, null, 2));
        process.exit(1);
    }

    return response.body;
}

async function loadMetadataForDomain(domain: string): Promise<{
    url: string;
    org: string;
    isPreviewUrl: boolean;
    enableAlgoliaOnPreview: boolean;
}> {
    const fdrOrigin =
        process.env.FDR_ORIGIN ?? process.env.NEXT_PUBLIC_FDR_ORIGIN ?? "https://registry.buildwithfern.com";
    const fernToken = process.env.FERN_TOKEN;

    console.error(`Loading metadata for domain: ${domain}`);
    console.error(`Using FDR origin: ${fdrOrigin}`);
    if (fernToken) {
        console.error("Using FERN_TOKEN for authentication");
    } else {
        console.error("No FERN_TOKEN provided (proceeding without authentication)");
    }

    const client = new FdrClient({
        environment: fdrOrigin,
        token: fernToken
    });

    const response = await client.docs.v2.read.getDocsUrlMetadata({
        url: FdrAPI.Url(domain)
    });

    if (!response.ok) {
        console.error("Failed to load metadata:");
        console.error(JSON.stringify(response.error, null, 2));
        process.exit(1);
    }

    return response.body;
}

interface PageInfo {
    slug: string;
    pageId: string;
}

function collectAllPages(root: any, pages: PageInfo[] = []): PageInfo[] {
    if (!root) {
        return pages;
    }

    // Handle array of items
    if (Array.isArray(root)) {
        for (const item of root) {
            collectAllPages(item, pages);
        }
        return pages;
    }

    // Check if this item is a page or landingPage
    if ((root.type === "page" || root.type === "landingPage") && root.slug && root.pageId) {
        pages.push({
            slug: root.slug,
            pageId: root.pageId
        });
    }

    // Recursively search all possible nested properties
    // Check common properties like 'child', 'children', 'items', 'pages', 'landingPage'
    const propsToSearch = ["child", "children", "items", "pages", "landingPage"];
    for (const prop of propsToSearch) {
        if (root[prop]) {
            collectAllPages(root[prop], pages);
        }
    }

    // Also search through all object values as a fallback
    if (typeof root === "object") {
        for (const key in root) {
            if (propsToSearch.includes(key)) {
                continue; // Already searched above
            }
            const value = root[key];
            if (value && typeof value === "object") {
                collectAllPages(value, pages);
            }
        }
    }

    return pages;
}

function findPageInRoot(root: any, slug: string): string | null {
    if (!root) {
        return null;
    }

    // Handle array of items
    if (Array.isArray(root)) {
        for (const item of root) {
            const result = findPageInRoot(item, slug);
            if (result) {
                return result;
            }
        }
        return null;
    }

    // Check if this item matches the slug (page or landingPage)
    if ((root.type === "page" || root.type === "landingPage") && root.slug === slug && root.pageId) {
        return root.pageId;
    }

    // Recursively search all possible nested properties
    // Check common properties like 'child', 'children', 'items', 'pages', 'landingPage'
    const propsToSearch = ["child", "children", "items", "pages", "landingPage"];
    for (const prop of propsToSearch) {
        if (root[prop]) {
            const result = findPageInRoot(root[prop], slug);
            if (result) {
                return result;
            }
        }
    }

    // Also search through all object values as a fallback
    if (typeof root === "object") {
        for (const key in root) {
            if (propsToSearch.includes(key)) {
                continue; // Already searched above
            }
            const value = root[key];
            if (value && typeof value === "object") {
                const result = findPageInRoot(value, slug);
                if (result) {
                    return result;
                }
            }
        }
    }

    return null;
}

function extractPageMarkdown(docsDefinition: FdrAPI.docs.v2.read.LoadDocsForUrlResponse, pageSlug: string): string {
    console.error(`\nSearching for page with slug: ${pageSlug}`);

    // Navigate to definition.config.root
    const definition = (docsDefinition as any).definition;
    if (!definition) {
        console.error("Error: No definition found in docs response");
        process.exit(1);
    }

    const config = definition.config;
    if (!config) {
        console.error("Error: No config found in definition");
        process.exit(1);
    }

    const root = config.root;
    if (!root) {
        console.error("Error: No root found in config");
        process.exit(1);
    }

    // Find the page in the root
    const pageId = findPageInRoot(root, pageSlug);

    if (!pageId) {
        console.error(`Error: Page with slug "${pageSlug}" not found in root config`);
        process.exit(1);
    }

    console.error(`Found page with pageId: ${pageId}`);

    // Get the page from definition.pages
    const pages = definition.pages;
    if (!pages) {
        console.error("Error: No pages found in definition");
        process.exit(1);
    }

    const page = pages[pageId];
    if (!page) {
        console.error(`Error: Page with pageId "${pageId}" not found in pages`);
        process.exit(1);
    }

    const markdown = page.markdown;
    if (!markdown) {
        console.error(`Error: No markdown found for page "${pageId}"`);
        process.exit(1);
    }

    return markdown;
}

async function main() {
    const options = parseArgs();

    try {
        // Handle --metadata option
        if (options.metadata) {
            const metadata = await loadMetadataForDomain(options.domain);
            const json = options.pretty ? JSON.stringify(metadata, null, 2) : JSON.stringify(metadata);

            if (options.output) {
                const outputPath = path.resolve(options.output);
                fs.writeFileSync(outputPath, json, "utf-8");
                console.error(`\nOutput written to: ${outputPath}`);
                console.error(`File size: ${(json.length / 1024).toFixed(2)} KB`);
            } else {
                // Write to stdout
                console.log(json);
            }

            console.error("\n✓ Successfully loaded metadata");
            return;
        }

        const docsDefinition = await loadDocsForDomain(options.domain);

        // Handle --list-pages option
        if (options.listPages) {
            const definition = (docsDefinition as any).definition;
            if (!definition) {
                console.error("Error: No definition found in docs response");
                process.exit(1);
            }

            const config = definition.config;
            if (!config) {
                console.error("Error: No config found in definition");
                process.exit(1);
            }

            const root = config.root;
            if (!root) {
                console.error("Error: No root found in config");
                process.exit(1);
            }

            const pages = collectAllPages(root);
            console.error(`\n✓ Found ${pages.length} pages\n`);
            console.error("=".repeat(80));
            console.error("PAGES:");
            console.error("=".repeat(80));

            // Print pages as formatted table
            for (const page of pages) {
                console.log(`${page.slug}\t${page.pageId}`);
            }
            return;
        }

        // Handle --page option
        if (options.page) {
            const markdown = extractPageMarkdown(docsDefinition, options.page);
            console.error("\n✓ Successfully extracted page markdown\n");
            console.error("=".repeat(80));
            console.error("MARKDOWN CONTENT:");
            console.error("=".repeat(80));
            // Print to stdout with newlines properly rendered
            console.log(markdown);
            return;
        }

        const json = options.pretty ? JSON.stringify(docsDefinition, null, 2) : JSON.stringify(docsDefinition);

        if (options.output) {
            const outputPath = path.resolve(options.output);
            fs.writeFileSync(outputPath, json, "utf-8");
            console.error(`\nOutput written to: ${outputPath}`);
            console.error(`File size: ${(json.length / 1024).toFixed(2)} KB`);
        } else {
            // Write to stdout
            console.log(json);
        }

        console.error("\n✓ Successfully loaded docs definition");
    } catch (error) {
        console.error("\n✗ Error loading docs:");
        console.error(error);
        process.exit(1);
    }
}

main();
