#!/usr/bin/env node

import "dotenv/config";
import { Command } from "commander";
import { runAgent, testTools, ValidationError } from "./agent.js";
import { validateOrganizationName, validateSiteId } from "./utils.js";

const program = new Command();

program
    .name("site-to-docs")
    .description("Convert a documentation website into a Fern documentation project")
    .version("0.0.0")
    .argument("<url>", "The root URL of the documentation site to convert")
    .option("-o, --output <dir>", "Output directory for generated files", "./output")
    .option("-m, --max-pages <number>", "Maximum number of pages to crawl", "128")
    .option("-d, --max-depth <number>", "Maximum depth for BFS crawling", "8")
    .option("-g, --max-group-size <number>", "Maximum pages per classification batch", "16")
    .option("-v, --verbose", "Enable verbose output", false)
    .option("-t, --test-tools", "Test that all tools are working", false)
    .option("--crawler-cache", "Use cached crawler results if available (useful for development)", false)
    .option("--classifier-cache", "Use cached classifier results if available (useful for development)", false)
    .requiredOption("-n, --organization <name>", "Organization name for Fern config")
    .requiredOption("-s, --site-id <id>", "Site ID for docs instance URL")
    .action(async (url: string, options) => {
        // Validate organization name and site ID early
        validateOrganizationName(options.organization);
        validateSiteId(options.siteId);

        // If testing tools, run the test function and exit
        if (options.testTools) {
            try {
                await testTools(url, options.verbose);
                console.log("All tools are working correctly!");
                process.exit(0);
            } catch (error) {
                console.error("Tool test failed:", error);
                process.exit(1);
            }
        }

        try {
            console.log(`\nsite-to-docs: Converting ${url}\n`);

            const result = await runAgent({
                url,
                outputDir: options.output,
                maxPages: parseInt(options.maxPages, 10),
                maxDepth: parseInt(options.maxDepth, 10),
                maxGroupSize: parseInt(options.maxGroupSize, 10),
                verbose: options.verbose,
                organization: options.organization,
                siteId: options.siteId,
                crawlerCache: options.crawlerCache,
                classifierCache: options.classifierCache
            });

            console.log(`\nConversion complete!`);
            console.log(`  Files written: ${result.writtenFiles.length}`);
            console.log(`  Warnings: ${result.warnings.length}`);

            if (result.warnings.length > 0) {
                console.log(`\nWarnings:`);
                result.warnings.forEach((warning) => {
                    console.log(`  - ${warning}`);
                });
            }

            console.log(`\nOutput directory: ${options.output}`);
        } catch (error) {
            if (error instanceof ValidationError) {
                // Expected error - clean output
                console.error(`Error: ${error.message}`);
            } else if (error instanceof Error) {
                // Unexpected error - show stack for debugging
                console.error(`Error: ${error.message}`);
                if (error.stack) {
                    console.error(error.stack);
                }
            } else {
                console.error(`Error:`, error);
            }
            process.exit(1);
        }
    });

program.parse();
