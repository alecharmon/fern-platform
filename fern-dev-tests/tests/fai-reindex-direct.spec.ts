import { expect, test } from "@playwright/test";

/**
 * Tests the FAI reindex endpoint directly for a domain with a basepath.
 *
 * Triggers a reindex via the FAI API for multi-repo-domain.docs.dev.buildwithfern.com/nemo,
 * polls until the job completes, and verifies:
 *   - The job record has the correct basepath persisted
 *   - The job inserted chunks
 *   - Turbopuffer contains chunks with the correct basepath
 *
 * Requires env vars:
 *   - FAI_DEV_ENDPOINT_TOKEN — for FAI reindex API calls
 *   - TURBOPUFFER_API_KEY    — for verifying chunks
 */

const FAI_BASE_URL = "https://fai-dev2.buildwithfern.com";
const DOMAIN = "multi-repo-domain.docs.dev.buildwithfern.com";
const BASEPATH = "/nemo";

const TURBOPUFFER_BASE_URL = "https://gcp-us-east4.turbopuffer.com/v2";
const TURBOPUFFER_NAMESPACE = `${DOMAIN}_query`;

const hasFaiToken = !!process.env.FAI_DEV_ENDPOINT_TOKEN;
const hasTurbopufferKey = !!process.env.TURBOPUFFER_API_KEY;
const hasRequiredTokens = hasFaiToken && hasTurbopufferKey;

if (!hasFaiToken) {
    console.log("Skipping FAI reindex direct tests: FAI_DEV_ENDPOINT_TOKEN is not set");
}
if (!hasTurbopufferKey) {
    console.log("Skipping FAI reindex direct tests: TURBOPUFFER_API_KEY is not set");
}

interface ReindexingJobRecord {
    id: string;
    domain: string;
    basepath: string;
    status: string;
    error?: string;
    num_inserted?: number;
    force_full_reindex: boolean;
    created_at: string;
    completed_at?: string;
}

interface TurbopufferRow {
    id: string;
    basepath: string;
    chunk: string;
    title: string;
    url: string;
    [key: string]: unknown;
}

/**
 * Trigger a reindex via the FAI API and return the job ID.
 */
async function triggerReindex(domain: string, basepath: string, forceFullReindex = true): Promise<string> {
    const params = new URLSearchParams({ domain, basepath, force_full_reindex: String(forceFullReindex) });

    const response = await fetch(`${FAI_BASE_URL}/settings/ask-ai/reindex?${params}`, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${process.env.FAI_DEV_ENDPOINT_TOKEN}`
        }
    });

    if (!response.ok) {
        const text = await response.text();
        throw new Error(`Reindex trigger failed (${response.status}): ${text}`);
    }

    const result = (await response.json()) as { success: boolean; job_id?: string };
    if (!result.success || !result.job_id) {
        throw new Error(`Reindex trigger returned success=false or no job_id: ${JSON.stringify(result)}`);
    }

    return result.job_id;
}

/**
 * Poll a reindex job by ID until it reaches a terminal state.
 */
async function waitForJobComplete(jobId: string, timeoutMs: number = 120_000): Promise<ReindexingJobRecord> {
    const start = Date.now();
    const pollIntervalMs = 5_000;

    while (Date.now() - start < timeoutMs) {
        const response = await fetch(`${FAI_BASE_URL}/reindexing/jobs/${jobId}`, {
            headers: {
                Authorization: `Bearer ${process.env.FAI_DEV_ENDPOINT_TOKEN}`
            }
        });

        if (!response.ok) {
            console.log(`Job status poll for ${jobId} returned ${response.status}, retrying...`);
            await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
            continue;
        }

        const job = (await response.json()) as ReindexingJobRecord;
        console.log(`Job ${jobId}: status=${job.status}`);

        if (job.status === "completed") {
            return job;
        }

        if (job.status === "failed") {
            throw new Error(`Reindex job ${jobId} failed: ${job.error ?? "unknown error"}`);
        }

        await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
    }

    throw new Error(`Reindex job ${jobId} timed out after ${timeoutMs}ms`);
}

/**
 * Query turbopuffer for chunks matching a specific basepath.
 */
async function queryTurbopufferChunks(basepath: string): Promise<TurbopufferRow[]> {
    const response = await fetch(`${TURBOPUFFER_BASE_URL}/namespaces/${TURBOPUFFER_NAMESPACE}/query`, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${process.env.TURBOPUFFER_API_KEY}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            rank_by: ["id", "asc"],
            top_k: 100,
            filters: ["basepath", "Eq", basepath],
            exclude_attributes: ["vector", "document"]
        })
    });

    if (!response.ok) {
        const text = await response.text();
        throw new Error(`Turbopuffer query failed (${response.status}): ${text}`);
    }

    const result = (await response.json()) as { rows: TurbopufferRow[] };
    return result.rows;
}

test.setTimeout(300_000); // 5 minutes

test.describe
    .serial("FAI reindex direct — with basepath", () => {
        test.skip(!hasRequiredTokens, "FAI_DEV_ENDPOINT_TOKEN or TURBOPUFFER_API_KEY is not set");

        let job: ReindexingJobRecord;

        test("trigger reindex for domain with basepath", async () => {
            const jobId = await triggerReindex(DOMAIN, BASEPATH);
            console.log(`Reindex triggered for ${DOMAIN}${BASEPATH}: job_id=${jobId}`);

            job = await waitForJobComplete(jobId);
            expect(job.status).toBe("completed");
            console.log(
                `Reindex completed: job_id=${job.id}, basepath=${job.basepath}, num_inserted=${job.num_inserted}, completed_at=${job.completed_at}`
            );
        });

        test("job record has correct basepath persisted", async () => {
            expect(job.basepath).toBe(BASEPATH);
            console.log(`Basepath correctly persisted: ${job.basepath}`);
        });

        test("job inserted chunks", async () => {
            expect(job.num_inserted).toBeGreaterThan(0);
            console.log(`Inserted ${job.num_inserted} chunks`);
        });

        test("turbopuffer contains chunks with correct basepath", async () => {
            // Wait for propagation
            await new Promise((resolve) => setTimeout(resolve, 15_000));

            const chunks = await queryTurbopufferChunks(BASEPATH);
            console.log(`Turbopuffer chunks for ${BASEPATH}: ${chunks.length}`);
            expect(chunks.length).toBeGreaterThan(0);

            for (const chunk of chunks) {
                expect(chunk.basepath).toBe(BASEPATH);
            }

            // Verify URLs contain the basepath
            for (const chunk of chunks) {
                expect(chunk.url).toContain(BASEPATH);
            }

            console.log(`All ${chunks.length} chunks have basepath=${BASEPATH} and correct URLs`);
        });
    });
