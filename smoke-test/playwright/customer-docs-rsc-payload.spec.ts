import { expect, test } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";
import { gzipSync } from "zlib";
import { CUSTOMER_DOCS } from "./customer-docs-pages";

// ── Thresholds ──────────────────────────────────────────────────
const WARNING_THRESHOLD_BYTES = 512 * 1024; // 512 KB — customer docs are much larger than the smoke test
const LARGE_THRESHOLD_BYTES = 1024 * 1024; // 1 MB
const REGRESSION_MIN_BYTES = 10 * 1024; // 10 KB minimum delta to flag (larger site = larger variance)
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 3000;

interface RscResult {
    customer: string;
    path: string;
    url: string;
    status: number;
    contentType: string;
    isRsc: boolean;
    sizeBytes: number;
    gzipSizeBytes: number;
    error?: string;
}

interface BaselineEntry {
    sizeBytes: number;
    gzipSizeBytes: number;
    status: number;
    isRsc: boolean;
    error?: string;
}

interface Baseline {
    pages: Record<string, BaselineEntry>;
}

// ── Helpers ─────────────────────────────────────────────────────

const RETRIABLE_PATTERNS = [/timeout/i, /ECONNRESET/i, /ECONNREFUSED/i, /ETIMEDOUT/i, /socket hang up/i, /net::/i];

function isRetriable(error: string): boolean {
    return RETRIABLE_PATTERNS.some((p) => p.test(error));
}

async function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function formatBytes(bytes: number): string {
    const abs = Math.abs(bytes);
    const sign = bytes < 0 ? "-" : "";
    if (abs < 1024) {
        return `${sign}${abs} B`;
    }
    if (abs < 1024 * 1024) {
        return `${sign}${(abs / 1024).toFixed(1)} KB`;
    }
    return `${sign}${(abs / (1024 * 1024)).toFixed(2)} MB`;
}

function formatDelta(current: number, baseline: number): string {
    if (baseline === 0) {
        return `+${formatBytes(current)} (new)`;
    }
    const delta = current - baseline;
    const pct = ((delta / baseline) * 100).toFixed(1);
    const sign = delta >= 0 ? "+" : "";
    return `${sign}${formatBytes(delta)} (${sign}${pct}%)`;
}

function generateReport(
    results: RscResult[],
    baseline: Baseline | null,
    customerName: string,
    customerHost: string
): { md: string; regressionCount: number } {
    const warnings = results.filter((r) => r.sizeBytes > WARNING_THRESHOLD_BYTES);

    let md = `## ${customerName} Docs RSC Payload Size Report\n\n`;
    md += `**Site:** \`${customerHost}\`\n\n`;

    // Baseline comparison (shown first for easy diffing)
    let regressionCount = 0;
    if (baseline?.pages) {
        const diffs: Array<RscResult & { baselineSize: number; delta: number; isNew?: boolean }> = [];
        for (const r of results) {
            const bl = baseline.pages[r.path];
            if (bl) {
                diffs.push({ ...r, baselineSize: bl.sizeBytes, delta: r.sizeBytes - bl.sizeBytes });
            } else {
                diffs.push({ ...r, baselineSize: 0, delta: r.sizeBytes, isNew: true });
            }
        }

        diffs.sort((a, b) => b.delta - a.delta);

        const regressions = diffs.filter((d) => d.delta > REGRESSION_MIN_BYTES);
        const improvements = diffs.filter((d) => d.delta < -REGRESSION_MIN_BYTES);

        if (regressions.length > 0 || improvements.length > 0) {
            md += "### Baseline Comparison\n\n";

            if (regressions.length > 0) {
                regressionCount = regressions.length;
                md += `**Regressions (${regressions.length} pages increased > ${formatBytes(REGRESSION_MIN_BYTES)}):**\n\n`;
                md += "| Page | Current | Baseline | Delta |\n|------|---------|----------|-------|\n";
                for (const d of regressions.slice(0, 25)) {
                    const tag = d.isNew ? "\u{1F195}" : "";
                    md += `| \`${d.path}\` | ${formatBytes(d.sizeBytes)} | ${d.isNew ? "\u2014" : formatBytes(d.baselineSize)} | ${tag} ${formatDelta(d.sizeBytes, d.baselineSize)} |\n`;
                }
                if (regressions.length > 25) {
                    md += `| ... | | | +${regressions.length - 25} more |\n`;
                }
                md += "\n";
            }

            if (improvements.length > 0) {
                md += `**Improvements (${improvements.length} pages decreased > ${formatBytes(REGRESSION_MIN_BYTES)}):**\n\n`;
                md += "| Page | Current | Baseline | Delta |\n|------|---------|----------|-------|\n";
                for (const d of improvements.slice(0, 10)) {
                    md += `| \`${d.path}\` | ${formatBytes(d.sizeBytes)} | ${formatBytes(d.baselineSize)} | ${formatDelta(d.sizeBytes, d.baselineSize)} |\n`;
                }
                md += "\n";
            }
        } else {
            md += "### Baseline Comparison\n\nNo significant changes from baseline.\n\n";
        }

        // Removed pages
        const currentPaths = new Set(results.map((r) => r.path));
        const removed = Object.keys(baseline.pages).filter((p) => !currentPaths.has(p));
        if (removed.length > 0) {
            md += `**Removed:** ${removed.map((p) => `\`${p}\``).join(", ")}\n\n`;
        }
    }

    // Large payloads table
    if (warnings.length > 0) {
        md += `### Large Payloads (> ${formatBytes(WARNING_THRESHOLD_BYTES)})\n\n`;
        md += "| Page | Size | Gzip | |\n|------|------|------|-|\n";
        for (const r of warnings) {
            const icon = r.sizeBytes > LARGE_THRESHOLD_BYTES ? "\u{1F534}" : "\u{1F7E1}";
            md += `| \`${r.path}\` | ${formatBytes(r.sizeBytes)} | ${formatBytes(r.gzipSizeBytes)} | ${icon} |\n`;
        }
        md += "\n";
    }

    // All pages (collapsible)
    md += `<details>\n<summary>All pages by RSC payload size (${results.length} pages)</summary>\n\n`;
    md += "| # | Page | Size | Gzip |\n|---|------|------|------|\n";
    results.forEach((r, i) => {
        const icon = r.error
            ? "\u274C"
            : r.sizeBytes > LARGE_THRESHOLD_BYTES
              ? "\u{1F534}"
              : r.sizeBytes > WARNING_THRESHOLD_BYTES
                ? "\u{1F7E1}"
                : "";
        md += `| ${i + 1} | \`${r.path}\` | ${icon} ${formatBytes(r.sizeBytes)} | ${formatBytes(r.gzipSizeBytes)} |\n`;
    });
    md += "\n</details>\n";

    return { md, regressionCount };
}

// ── Test ────────────────────────────────────────────────────────

test.describe("Customer Docs RSC Payload Size Analysis", () => {
    for (const customer of CUSTOMER_DOCS) {
        test(`measure RSC payload sizes for ${customer.name} docs`, async ({ page, baseURL }) => {
            // Increase timeout — fetching from Vercel preview can be slow
            test.setTimeout(600_000);

            // 1. Visit base URL to establish initial connection
            await page.goto("/", { waitUntil: "domcontentloaded", timeout: 60_000 });

            // 2. Use the customer's page list
            const pagePathnames = [...customer.pages];
            console.log(`${customer.name} docs pages to measure: ${pagePathnames.length}`);
            expect(pagePathnames.length, "Should find at least one page").toBeGreaterThan(0);

            // 3. Fetch RSC payload for each page
            const results: RscResult[] = [];

            for (const pathname of pagePathnames) {
                let lastError = "";
                let succeeded = false;

                for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
                    try {
                        const rscResponse = await page.request.fetch(`${baseURL}${pathname}`, {
                            headers: {
                                RSC: "1",
                                "Next-Url": pathname,
                                "x-fern-host": customer.host
                            },
                            timeout: 120_000 // longer timeout for large API pages
                        });

                        const body = await rscResponse.body();
                        const gzipped = gzipSync(body);
                        const contentType = rscResponse.headers()["content-type"] || "";

                        const result: RscResult = {
                            customer: customer.name,
                            path: pathname,
                            url: `${baseURL}${pathname}`,
                            status: rscResponse.status(),
                            contentType,
                            isRsc: contentType.includes("text/x-component"),
                            sizeBytes: body.length,
                            gzipSizeBytes: gzipped.length
                        };

                        const sizeStr = `${formatBytes(result.sizeBytes)} (gzip: ${formatBytes(result.gzipSizeBytes)})`;
                        const rscTag = result.isRsc ? "" : " [not RSC]";
                        console.log(`  [${customer.name}] ${pathname}: ${sizeStr}${rscTag}`);

                        results.push(result);
                        succeeded = true;
                        break;
                    } catch (err: unknown) {
                        lastError = err instanceof Error ? err.message : String(err);
                        if (attempt < MAX_RETRIES && isRetriable(lastError)) {
                            console.log(
                                `  [${customer.name}] ${pathname}: retry ${attempt}/${MAX_RETRIES} — ${lastError}`
                            );
                            await sleep(RETRY_DELAY_MS * attempt);
                        }
                    }
                }

                if (!succeeded) {
                    console.log(`  [${customer.name}] ${pathname}: ERROR: ${lastError}`);
                    results.push({
                        customer: customer.name,
                        path: pathname,
                        url: `${baseURL}${pathname}`,
                        status: 0,
                        contentType: "",
                        isRsc: false,
                        sizeBytes: 0,
                        gzipSizeBytes: 0,
                        error: lastError
                    });
                }
            }

            // Sort by size (largest first)
            results.sort((a, b) => b.sizeBytes - a.sizeBytes);

            // 4. Load baseline (if provided via env var)
            const customerSlug = customer.name.toLowerCase();
            let baseline: Baseline | null = null;
            const baselinePath = process.env.CUSTOMER_RSC_BASELINE_PATH || "";
            if (baselinePath && fs.existsSync(baselinePath)) {
                try {
                    const allBaselines = JSON.parse(fs.readFileSync(baselinePath, "utf-8"));
                    if (allBaselines[customerSlug]) {
                        baseline = allBaselines[customerSlug] as Baseline;
                        console.log(
                            `Loaded baseline for ${customer.name} from ${baselinePath} (${Object.keys(baseline.pages || {}).length} pages)`
                        );
                    }
                } catch {
                    console.warn(`Failed to parse baseline at ${baselinePath}`);
                }
            }

            // 5. Generate report
            const { md, regressionCount } = generateReport(results, baseline, customer.name, customer.host);

            // 6. Write output files
            const outputDir = path.resolve(__dirname, "..");
            const output = {
                timestamp: new Date().toISOString(),
                baseUrl: baseURL,
                customer: customer.name,
                site: customer.host,
                totalPages: results.length,
                totalSizeBytes: results.reduce((s, r) => s + r.sizeBytes, 0),
                totalGzipSizeBytes: results.reduce((s, r) => s + r.gzipSizeBytes, 0),
                warningThresholdBytes: WARNING_THRESHOLD_BYTES,
                largeThresholdBytes: LARGE_THRESHOLD_BYTES,
                pages: Object.fromEntries(
                    results.map((r) => [
                        r.path,
                        {
                            sizeBytes: r.sizeBytes,
                            gzipSizeBytes: r.gzipSizeBytes,
                            status: r.status,
                            isRsc: r.isRsc,
                            ...(r.error ? { error: r.error } : {})
                        }
                    ])
                )
            };

            const warningPages = results.filter((r) => r.sizeBytes > WARNING_THRESHOLD_BYTES);
            const hasOversizedPages = warningPages.length > 0 || regressionCount > 0;

            fs.writeFileSync(
                path.join(outputDir, `customer-rsc-payload-results-${customerSlug}.json`),
                JSON.stringify(output, null, 2)
            );
            fs.writeFileSync(path.join(outputDir, `customer-rsc-payload-summary-${customerSlug}.md`), md);
            fs.writeFileSync(
                path.join(outputDir, `customer-rsc-payload-has-warnings-${customerSlug}`),
                hasOversizedPages ? "true" : "false"
            );

            console.log(`\n${customer.name} Docs RSC Payload Report:`);
            console.log(`  Site: ${customer.host}`);
            console.log(`  Pages crawled: ${results.length}`);
            console.log(`  Total size: ${formatBytes(output.totalSizeBytes)}`);
            console.log(`  Total gzip: ${formatBytes(output.totalGzipSizeBytes)}`);
            console.log(
                `  > ${formatBytes(WARNING_THRESHOLD_BYTES)}: ${results.filter((r) => r.sizeBytes > WARNING_THRESHOLD_BYTES).length}`
            );
            console.log(
                `  > ${formatBytes(LARGE_THRESHOLD_BYTES)}: ${results.filter((r) => r.sizeBytes > LARGE_THRESHOLD_BYTES).length}`
            );

            if (regressionCount > 0) {
                console.log(`  Regressions: ${regressionCount}`);
            }
        });
    }
});
