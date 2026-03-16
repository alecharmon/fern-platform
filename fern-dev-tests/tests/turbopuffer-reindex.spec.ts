import { expect, test } from "@playwright/test";

/**
 * Turbopuffer reindexing tests for docs sites deployed to dev.
 *
 * Tests the full reindexing pipeline: triggers a reindex via the FAI API,
 * polls until completion, then verifies that Turbopuffer contains the
 * expected chunks with correct attributes.
 *
 * Tests both domains with and without basepaths to ensure the reindexing
 * pipeline handles both cases correctly.
 *
 * Requires:
 *   - FERN_TOKEN env var (set via FERN_DEV_ORG_TESTING_TOKEN secret in CI)
 *   - TURBOPUFFER_API_KEY env var (set via TURBOPUFFER_API_KEY secret in CI)
 *
 * To run locally:
 *   export FERN_TOKEN=<your-dev-token>
 *   export TURBOPUFFER_API_KEY=<your-turbopuffer-key>
 *   npx playwright test tests/turbopuffer-reindex.spec.ts
 */

const FAI_BASE_URL = "https://fai-dev2.buildwithfern.com";
const TURBOPUFFER_BASE_URL = "https://gcp-us-east4.turbopuffer.com/v2";

const hasFernToken = !!process.env.FERN_TOKEN;
const hasTurbopufferKey = !!process.env.TURBOPUFFER_API_KEY;

if (!hasFernToken) {
    console.log("Skipping turbopuffer reindex tests: FERN_TOKEN is not set");
}
if (!hasTurbopufferKey) {
    console.log("Skipping turbopuffer reindex tests: TURBOPUFFER_API_KEY is not set");
}

interface TurbopufferQueryResponse {
    data: Array<{
        id: number;
        attributes: Record<string, unknown>;
        dist?: number;
    }>;
    billing: Record<string, unknown>;
    performance: Record<string, unknown>;
}

/**
 * Derives the Turbopuffer namespace from a domain.
 * Mirrors the logic in turbopuffer.ts: flattenDomain(withoutStaging(domain)) + "_fern_docs"
 *
 * For dev domains (.docs.dev.buildwithfern.com), withoutStaging is a no-op
 * since it only handles .docs.staging.buildwithfern.com domains.
 */
function getTurbopufferNamespace(domain: string): string {
    const flattened = domain.replace(/\//g, "_");
    return `${flattened}_fern_docs`;
}

/**
 * Query the Turbopuffer _query namespace to get the total number of chunks.
 */
async function getTurbopufferChunkCount(namespace: string, basepathFilter?: string): Promise<number> {
    const body: Record<string, unknown> = {
        rank_by: ["id", "asc"],
        top_k: 10000,
        include_attributes: ["id"]
    };

    if (basepathFilter) {
        body.filters = ["basepath", "Eq", basepathFilter];
    }

    const response = await fetch(`${TURBOPUFFER_BASE_URL}/namespaces/${namespace}/query`, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${process.env.TURBOPUFFER_API_KEY}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify(body)
    });

    if (!response.ok) {
        const text = await response.text();
        throw new Error(`Turbopuffer query failed (${response.status}): ${text}`);
    }

    const result = (await response.json()) as TurbopufferQueryResponse;
    return result.data.length;
}

/**
 * Query Turbopuffer to get a sample of chunks with their attributes.
 */
async function getTurbopufferSample(
    namespace: string,
    topK: number = 5,
    basepathFilter?: string
): Promise<TurbopufferQueryResponse> {
    const body: Record<string, unknown> = {
        rank_by: ["id", "asc"],
        top_k: topK,
        exclude_attributes: ["vector"]
    };

    if (basepathFilter) {
        body.filters = ["basepath", "Eq", basepathFilter];
    }

    const response = await fetch(`${TURBOPUFFER_BASE_URL}/namespaces/${namespace}/query`, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${process.env.TURBOPUFFER_API_KEY}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify(body)
    });

    if (!response.ok) {
        const text = await response.text();
        throw new Error(`Turbopuffer query failed (${response.status}): ${text}`);
    }

    return (await response.json()) as TurbopufferQueryResponse;
}

/**
 * Trigger a reindex via the FAI API and return the response.
 */
async function triggerReindex(
    domain: string,
    options: { forceFullReindex?: boolean; basepath?: string } = {}
): Promise<{ success: boolean; job_id?: string }> {
    const params = new URLSearchParams({ domain });
    if (options.forceFullReindex) {
        params.set("force_full_reindex", "true");
    }
    if (options.basepath) {
        params.set("basepath", options.basepath);
    }

    const response = await fetch(`${FAI_BASE_URL}/settings/ask-ai/reindex?${params}`, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${process.env.FERN_TOKEN}`
        }
    });

    if (!response.ok) {
        const text = await response.text();
        throw new Error(`Reindex trigger failed (${response.status}): ${text}`);
    }

    return (await response.json()) as { success: boolean; job_id?: string };
}

/**
 * Poll the reindex status until it completes or times out.
 */
async function waitForReindexComplete(domain: string, timeoutMs: number = 300_000): Promise<string> {
    const start = Date.now();
    const pollIntervalMs = 5_000;

    while (Date.now() - start < timeoutMs) {
        const response = await fetch(
            `${FAI_BASE_URL}/settings/ask-ai/toggle/status?domain=${encodeURIComponent(domain)}`,
            {
                headers: {
                    Authorization: `Bearer ${process.env.FERN_TOKEN}`
                }
            }
        );

        if (!response.ok) {
            console.log(`Status poll returned ${response.status}, retrying...`);
            await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
            continue;
        }

        const result = (await response.json()) as { status: string; ask_ai_enabled: boolean };
        console.log(`Reindex status for ${domain}: ${result.status}`);

        if (result.status === "completed") {
            return result.status;
        }

        if (result.status === "failed") {
            throw new Error(`Reindex failed for ${domain}`);
        }

        await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
    }

    throw new Error(`Reindex timed out after ${timeoutMs}ms for ${domain}`);
}

// Reindex can take several minutes
test.setTimeout(600_000); // 10 minutes

// ─── Tests for domain WITHOUT basepath ───────────────────────────────

test.describe
    .serial("turbopuffer reindex — no basepath", () => {
        test.skip(true, "turbopuffer reindex tests are temporarily disabled");
        test.skip(!hasFernToken || !hasTurbopufferKey, "FERN_TOKEN or TURBOPUFFER_API_KEY is not set");

        const domain = "multi-repo-smoke-test.docs.dev.buildwithfern.com";
        const namespace = getTurbopufferNamespace(domain);
        let chunkCountBefore: number;

        test("record chunk count before reindex", async () => {
            chunkCountBefore = await getTurbopufferChunkCount(namespace);
            console.log(`Chunk count before reindex (${domain}): ${chunkCountBefore}`);
            expect(chunkCountBefore).toBeGreaterThan(0);
        });

        test("trigger reindex succeeds", async () => {
            const result = await triggerReindex(domain, { forceFullReindex: true });
            console.log(`Reindex triggered for ${domain}:`, JSON.stringify(result));
            expect(result.success).toBe(true);
        });

        test("reindex completes", async () => {
            const status = await waitForReindexComplete(domain);
            expect(status).toBe("completed");
        });

        test("chunk count is preserved after reindex", async () => {
            const chunkCountAfter = await getTurbopufferChunkCount(namespace);
            console.log(`Chunk count after reindex (${domain}): ${chunkCountAfter}`);
            expect(chunkCountAfter).toBeGreaterThan(0);
            // Allow some variance (pages may have changed slightly) but count should be in the same ballpark
            const ratio = chunkCountAfter / chunkCountBefore;
            console.log(`Chunk count ratio (after/before): ${ratio.toFixed(2)}`);
            expect(ratio).toBeGreaterThan(0.8);
            expect(ratio).toBeLessThan(1.2);
        });

        test("chunks have expected attributes", async () => {
            const sample = await getTurbopufferSample(namespace, 3);
            expect(sample.data.length).toBeGreaterThan(0);

            for (const row of sample.data) {
                expect(row.attributes).toBeDefined();
                expect(row.attributes.parent_id).toBeDefined();
                expect(row.attributes.title).toBeDefined();
                console.log(`Chunk ${row.id}: parent_id=${row.attributes.parent_id}, title=${row.attributes.title}`);
            }
        });
    });

// ─── Tests for domain WITH basepath ──────────────────────────────────

test.describe
    .serial("turbopuffer reindex — with basepath", () => {
        test.skip(true, "turbopuffer reindex tests are temporarily disabled");
        test.skip(!hasFernToken || !hasTurbopufferKey, "FERN_TOKEN or TURBOPUFFER_API_KEY is not set");

        const domain = "multi-repo-smoke-test.docs.dev.buildwithfern.com";
        const basepath = "/nemo";
        const namespace = getTurbopufferNamespace(domain);
        let chunkCountBefore: number;

        test("record basepath chunk count before reindex", async () => {
            chunkCountBefore = await getTurbopufferChunkCount(namespace, basepath);
            console.log(`Basepath chunk count before reindex (${domain}${basepath}): ${chunkCountBefore}`);
            expect(chunkCountBefore).toBeGreaterThan(0);
        });

        test("trigger basepath reindex succeeds", async () => {
            const result = await triggerReindex(domain, {
                forceFullReindex: true,
                basepath
            });
            console.log(`Basepath reindex triggered for ${domain}${basepath}:`, JSON.stringify(result));
            expect(result.success).toBe(true);
        });

        test("basepath reindex completes", async () => {
            const status = await waitForReindexComplete(domain);
            expect(status).toBe("completed");
        });

        test("basepath chunk count is preserved after reindex", async () => {
            const chunkCountAfter = await getTurbopufferChunkCount(namespace, basepath);
            console.log(`Basepath chunk count after reindex (${domain}${basepath}): ${chunkCountAfter}`);
            expect(chunkCountAfter).toBeGreaterThan(0);
            const ratio = chunkCountAfter / chunkCountBefore;
            console.log(`Basepath chunk count ratio (after/before): ${ratio.toFixed(2)}`);
            expect(ratio).toBeGreaterThan(0.8);
            expect(ratio).toBeLessThan(1.2);
        });

        test("basepath chunks are correctly tagged", async () => {
            const sample = await getTurbopufferSample(namespace, 5, basepath);
            expect(sample.data.length).toBeGreaterThan(0);

            for (const row of sample.data) {
                expect(row.attributes).toBeDefined();
                expect(row.attributes.parent_id).toBeDefined();
                expect(row.attributes.title).toBeDefined();
                expect(row.attributes.basepath).toBe(basepath);
                console.log(
                    `Basepath chunk ${row.id}: parent_id=${row.attributes.parent_id}, ` +
                        `title=${row.attributes.title}, basepath=${row.attributes.basepath}`
                );
            }
        });
    });
