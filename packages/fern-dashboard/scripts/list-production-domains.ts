#!/usr/bin/env npx tsx
/**
 * List all production domains from the KV store or FDR
 *
 * Usage:
 *   npx tsx scripts/list-production-domains.ts
 *   npx tsx scripts/list-production-domains.ts --include-previews
 *   npx tsx scripts/list-production-domains.ts --force-fdr
 *   npx tsx scripts/list-production-domains.ts --force-fdr --json
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
            "force-fdr": { type: "boolean", default: false },
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
  --force-fdr         Force fetching from FDR instead of KV store
  --json              Output as JSON
  -h, --help          Show this help message
        `);
        process.exit(0);
    }

    // Check for either KV (with CDN_URI) or FDR credentials
    const hasKV = process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN && process.env.NEXT_PUBLIC_CDN_URI;
    const hasFDR = (process.env.FDR_SERVER_URL || process.env.NEXT_PUBLIC_FDR_ORIGIN) && process.env.FERN_TOKEN;

    // If forcing FDR, require FDR credentials
    if (values["force-fdr"] && !hasFDR) {
        console.error(
            "Error: --force-fdr requires FDR credentials (FDR_SERVER_URL/NEXT_PUBLIC_FDR_ORIGIN, FERN_TOKEN)"
        );
        process.exit(1);
    }

    if (!hasKV && !hasFDR) {
        console.error("Error: Either KV credentials (KV_REST_API_URL, KV_REST_API_TOKEN, NEXT_PUBLIC_CDN_URI)");
        console.error("       or FDR credentials (FDR_SERVER_URL/NEXT_PUBLIC_FDR_ORIGIN, FERN_TOKEN) are required");
        process.exit(1);
    }

    const source = values["force-fdr"] ? "FDR (forced)" : hasKV ? "KV store" : "FDR";
    console.log(`Using ${source} to fetch domains...\n`);

    const getAllProductionDomainsModule = await import("../src/app/services/analyticsCron/getAllProductionDomains");

    try {
        if (values["include-previews"]) {
            const { getAllDomainsIncludingPreviews } = getAllProductionDomainsModule;
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
            // Use FDR directly if --force-fdr is set, otherwise use the smart function
            const domains = values["force-fdr"]
                ? await getAllProductionDomainsModule.getAllProductionDomainsFromFDR()
                : await getAllProductionDomainsModule.getAllProductionDomains();

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
