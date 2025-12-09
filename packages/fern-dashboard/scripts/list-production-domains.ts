#!/usr/bin/env npx tsx
/**
 * List all production domains from the KV store
 *
 * Usage:
 *   npx tsx scripts/list-production-domains.ts
 *   npx tsx scripts/list-production-domains.ts --include-previews
 *   npx tsx scripts/list-production-domains.ts --json
 */

import { config } from "dotenv";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";
import { parseArgs } from "util";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

config({ path: resolve(__dirname, "../.env.local") });

process.env.NODE_ENV = "test";

async function main() {
    const { values } = parseArgs({
        options: {
            "include-previews": { type: "boolean", default: false },
            json: { type: "boolean", default: false },
            help: { type: "boolean", short: "h" }
        },
        allowPositionals: false
    });

    if (values.help) {
        console.log(`
List Production Domains

Usage:
  npx tsx scripts/list-production-domains.ts [options]

Options:
  --include-previews  Include Fern-hosted preview domains (*.docs.buildwithfern.com)
  --json              Output as JSON
  -h, --help          Show this help message
        `);
        process.exit(0);
    }

    // Check for either KV (with CDN_URI) or FDR credentials
    const hasKV = process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN && process.env.NEXT_PUBLIC_CDN_URI;
    const hasFDR = (process.env.FDR_SERVER_URL || process.env.NEXT_PUBLIC_FDR_ORIGIN) && process.env.FERN_TOKEN;

    if (!hasKV && !hasFDR) {
        console.error("Error: Either KV credentials (KV_REST_API_URL, KV_REST_API_TOKEN, NEXT_PUBLIC_CDN_URI)");
        console.error("       or FDR credentials (FDR_SERVER_URL/NEXT_PUBLIC_FDR_ORIGIN, FERN_TOKEN) are required");
        process.exit(1);
    }

    console.log(`Using ${hasKV ? "KV store" : "FDR"} to fetch domains...\n`);

    const { getAllProductionDomains, getAllDomainsIncludingPreviews } = await import(
        "../src/app/services/analyticsCron/getAllProductionDomains"
    );

    try {
        if (values["include-previews"]) {
            const domains = await getAllDomainsIncludingPreviews();

            if (values.json) {
                console.log(JSON.stringify(domains, null, 2));
            } else {
                console.log(`\nFound ${domains.length} domains (including previews):\n`);
                for (const domain of domains) {
                    console.log(`  ${domain}`);
                }
            }
        } else {
            const domains = await getAllProductionDomains();

            if (values.json) {
                console.log(JSON.stringify(domains, null, 2));
            } else {
                const customDomains = domains.filter((d) => d.isCustomDomain);
                const fernDomains = domains.filter((d) => !d.isCustomDomain);

                console.log(`\nFound ${domains.length} production domains:\n`);
                console.log(`Custom domains (${customDomains.length}):`);
                for (const d of customDomains) {
                    console.log(`  ${d.domain}`);
                }
                console.log(`\nFern-hosted domains (${fernDomains.length}):`);
                for (const d of fernDomains) {
                    console.log(`  ${d.domain}`);
                }
            }
        }
    } catch (error) {
        console.error("Error fetching domains:", error);
        process.exit(1);
    }
}

main();
