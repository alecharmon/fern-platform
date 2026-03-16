import { expect, test } from "@playwright/test";
import { execSync } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";

/**
 * Basepath-aware reindexing + FAI chat integration test.
 *
 * Validates the full reindex pipeline with basepath isolation and hierarchy:
 *   1. Clones fern-testing-umbrella, updates the APPLE basepath's content
 *      with a unique timestamp keyword
 *   2. Publishes the updated APPLE docs via `fern-dev generate --docs`
 *   3. Triggers FAI reindex for APPLE, BANANA, and COSMIC_CRISP basepaths
 *   4. Polls until all reindex jobs complete
 *   5. Verifies chunks in turbopuffer have correct basepath isolation
 *   6. Queries FAI chat for each basepath and verifies:
 *      - APPLE returns APPLE keyword + test marker, and also COSMIC_CRISP content (hierarchical)
 *      - BANANA returns BANANA keyword only (isolated from APPLE tree)
 *      - COSMIC_CRISP returns COSMIC_CRISP keyword only (isolated from APPLE parent)
 *
 * Requires env vars (set in CI via GitHub Actions secrets):
 *   - DEV_SMOKE_TEST_FERN_TOKEN — for publishing docs (smoke-test org)
 *   - FAI_DEV_ENDPOINT_TOKEN    — for FAI reindex/chat API calls
 *   - TURBOPUFFER_API_KEY       — for verifying chunks in turbopuffer
 *
 * To run locally:
 *   npx playwright test tests/basepath-reindex-chat.spec.ts
 */

const FAI_BASE_URL = "https://fai-dev2.buildwithfern.com";
const FAI_CHAT_BASE_URL = "https://fai-chat-dev2.buildwithfern.com";
const DOMAIN = "fruits.docs.dev.buildwithfern.com";
const UMBRELLA_REPO_URL = "https://github.com/fern-api/fern-testing-umbrella.git";

const APPLE_BASEPATH = "/apple";
const BANANA_BASEPATH = "/banana";
const COSMIC_CRISP_BASEPATH = "/apple/cosmic-crisp";

const TURBOPUFFER_BASE_URL = "https://gcp-us-east4.turbopuffer.com/v2";
const TURBOPUFFER_NAMESPACE = `${DOMAIN}_query`;

const hasPublishToken = !!process.env.DEV_SMOKE_TEST_FERN_TOKEN;
const hasFaiToken = !!process.env.FAI_DEV_ENDPOINT_TOKEN;
const hasTurbopufferKey = !!process.env.TURBOPUFFER_API_KEY;
const hasRequiredTokens = hasPublishToken && hasFaiToken && hasTurbopufferKey;

if (!hasPublishToken) {
    console.log("Skipping basepath reindex chat tests: DEV_SMOKE_TEST_FERN_TOKEN is not set");
}
if (!hasFaiToken) {
    console.log("Skipping basepath reindex chat tests: FAI_DEV_ENDPOINT_TOKEN is not set");
}
if (!hasTurbopufferKey) {
    console.log("Skipping basepath reindex chat tests: TURBOPUFFER_API_KEY is not set");
}

// Unique marker so we can verify the freshly-indexed content
const TEST_RUN_ID = `TEST_RUN_${Date.now()}`;

interface ReindexingJobRecord {
    id: string;
    domain: string;
    basepath: string;
    status: string;
    error?: string;
    num_inserted?: number;
    created_at: string;
    updated_at: string;
    completed_at?: string;
}

interface TurbopufferRow {
    id: string;
    basepath: string;
    chunk: string;
    title: string;
    url: string;
    parent_id: string;
    [key: string]: unknown;
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

/**
 * Fetch the latest reindex job for a domain+basepath.
 */
async function getLatestJob(domain: string, basepath: string): Promise<ReindexingJobRecord | null> {
    const params = new URLSearchParams({ basepath });
    const response = await fetch(`${FAI_BASE_URL}/reindexing/jobs/domain/${domain}/latest?${params}`, {
        headers: {
            Authorization: `Bearer ${process.env.FAI_DEV_ENDPOINT_TOKEN}`
        }
    });

    if (response.status === 404) {
        return null;
    }

    if (!response.ok) {
        const text = await response.text();
        throw new Error(`Get latest job failed (${response.status}): ${text}`);
    }

    return (await response.json()) as ReindexingJobRecord;
}

/**
 * Poll the latest reindex job for a domain+basepath until a job created after
 * `afterTimestamp` reaches a terminal state.
 */
async function waitForAutoReindex(
    domain: string,
    basepath: string,
    afterTimestamp: string,
    timeoutMs: number = 120_000
): Promise<ReindexingJobRecord> {
    const start = Date.now();
    const pollIntervalMs = 5_000;
    const afterDate = new Date(afterTimestamp);

    while (Date.now() - start < timeoutMs) {
        const job = await getLatestJob(domain, basepath);

        if (job) {
            const jobCreated = new Date(job.created_at);
            if (jobCreated >= afterDate) {
                console.log(
                    `Found reindex job ${job.id} for ${basepath}: status=${job.status}, created_at=${job.created_at}`
                );

                if (job.status === "completed") {
                    return job;
                }

                if (job.status === "failed") {
                    throw new Error(`Reindex job ${job.id} failed: ${job.error ?? "unknown error"}`);
                }
            } else {
                console.log(
                    `Latest job for ${basepath} (created_at=${job.created_at}) is before publish (${afterTimestamp}), waiting...`
                );
            }
        } else {
            console.log(`No reindex job found for ${basepath} yet, waiting...`);
        }

        await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
    }

    throw new Error(`No reindex job created after ${afterTimestamp} for ${domain}${basepath} within ${timeoutMs}ms`);
}

/**
 * Query the FAI streaming chat endpoint for a domain+basepath.
 *
 * Uses the fai-chat service (streaming SSE) which is the same endpoint
 * the frontend uses. Accumulates text-delta events into a single string.
 */
async function queryChatApi(domain: string, basepath: string, question: string): Promise<string> {
    const response = await fetch(`${FAI_CHAT_BASE_URL}/chat`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "x-fern-host": domain,
            "x-fern-basepaths": JSON.stringify([basepath]),
            FERN_TOKEN: process.env.FAI_DEV_ENDPOINT_TOKEN ?? ""
        },
        body: JSON.stringify({
            messages: [{ role: "user", parts: [{ type: "text", text: question }] }]
        })
    });

    if (!response.ok) {
        const text = await response.text();
        throw new Error(`Chat query failed (${response.status}): ${text}`);
    }

    // Read the SSE stream and accumulate text-delta events
    const body = await response.text();
    let accumulated = "";

    for (const line of body.split("\n")) {
        if (!line.startsWith("data: ")) {
            continue;
        }
        const payload = line.slice("data: ".length).trim();
        if (payload === "[DONE]") {
            break;
        }
        try {
            const event = JSON.parse(payload) as { type: string; delta?: string };
            if (event.type === "text-delta" && event.delta) {
                accumulated += event.delta;
            }
        } catch {
            // skip non-JSON lines
        }
    }

    if (!accumulated) {
        throw new Error("No text content received from streaming chat response");
    }

    return accumulated;
}

// Full pipeline can take a while: publish (~3 min) + reindex (~5 min each) + chat queries
test.setTimeout(900_000); // 15 minutes

test.describe
    .serial("basepath reindex + chat verification", () => {
        test.skip(
            !hasRequiredTokens,
            "DEV_SMOKE_TEST_FERN_TOKEN, FAI_DEV_ENDPOINT_TOKEN, or TURBOPUFFER_API_KEY is not set"
        );

        let repoDir: string;
        let publishTimestamp: string;
        let appleJob: ReindexingJobRecord;
        let bananaJob: ReindexingJobRecord;
        let cosmicCrispJob: ReindexingJobRecord;

        test("clone umbrella repo and update APPLE content with unique marker", async () => {
            repoDir = fs.mkdtempSync(path.join(os.tmpdir(), "fern-testing-umbrella-"));
            console.log(`Cloning ${UMBRELLA_REPO_URL} into ${repoDir}`);
            execSync(`git clone --depth 1 ${UMBRELLA_REPO_URL} ${repoDir}`, {
                stdio: "inherit",
                timeout: 60_000
            });

            // Update the APPLE reindex-test.mdx with a unique marker
            const appleReindexFile = path.join(repoDir, "fruits-apple/fern/docs/pages/reindex-test.mdx");
            const newContent = [
                "---",
                "title: Reindex test",
                "---",
                "",
                "# Reindex test page for Apple",
                "",
                "This page is used by automated tests to verify the FAI reindexing pipeline.",
                "",
                `REINDEX_KEYWORD: APPLE`,
                "",
                `REINDEX_TEST_MARKER: ${TEST_RUN_ID}`,
                ""
            ].join("\n");

            fs.writeFileSync(appleReindexFile, newContent);
            console.log(`Updated ${appleReindexFile} with marker: ${TEST_RUN_ID}`);
        });

        test("publish APPLE docs via fern-dev CLI", async () => {
            publishTimestamp = new Date().toISOString();
            console.log(`Publishing APPLE docs... (publish timestamp: ${publishTimestamp})`);

            const output = execSync("npx fern-dev generate --docs --no-prompt", {
                cwd: path.join(repoDir, "fruits-apple"),
                timeout: 300_000,
                env: {
                    ...process.env,
                    FERN_TOKEN: process.env.DEV_SMOKE_TEST_FERN_TOKEN
                },
                encoding: "utf-8",
                stdio: ["pipe", "pipe", "pipe"]
            });

            console.log("fern-dev generate output:", output);
        });

        test("publish BANANA docs via fern-dev CLI", async () => {
            console.log("Publishing BANANA docs...");

            const output = execSync("npx fern-dev generate --docs --no-prompt", {
                cwd: path.join(repoDir, "fruits-banana"),
                timeout: 300_000,
                env: {
                    ...process.env,
                    FERN_TOKEN: process.env.DEV_SMOKE_TEST_FERN_TOKEN
                },
                encoding: "utf-8",
                stdio: ["pipe", "pipe", "pipe"]
            });

            console.log("fern-dev generate output:", output);
        });

        test("publish COSMIC_CRISP docs via fern-dev CLI", async () => {
            console.log("Publishing COSMIC_CRISP docs...");

            const output = execSync("npx fern-dev generate --docs --no-prompt", {
                cwd: path.join(repoDir, "fruits-cosmic-crisp"),
                timeout: 300_000,
                env: {
                    ...process.env,
                    FERN_TOKEN: process.env.DEV_SMOKE_TEST_FERN_TOKEN
                },
                encoding: "utf-8",
                stdio: ["pipe", "pipe", "pipe"]
            });

            console.log("fern-dev generate output:", output);
        });

        test("wait for APPLE publish-triggered reindex to complete", async () => {
            console.log("Waiting 5 seconds before polling for publish-triggered reindex...");
            await new Promise((resolve) => setTimeout(resolve, 5_000));

            appleJob = await waitForAutoReindex(DOMAIN, APPLE_BASEPATH, publishTimestamp);
            expect(appleJob.status).toBe("completed");
            console.log(
                `Apple reindex completed: job_id=${appleJob.id}, num_inserted=${appleJob.num_inserted}, completed_at=${appleJob.completed_at}`
            );
        });

        test("wait for BANANA publish-triggered reindex to complete", async () => {
            bananaJob = await waitForAutoReindex(DOMAIN, BANANA_BASEPATH, publishTimestamp);
            expect(bananaJob.status).toBe("completed");
            console.log(
                `Banana reindex completed: job_id=${bananaJob.id}, num_inserted=${bananaJob.num_inserted}, completed_at=${bananaJob.completed_at}`
            );
        });

        test("wait for COSMIC_CRISP publish-triggered reindex to complete", async () => {
            cosmicCrispJob = await waitForAutoReindex(DOMAIN, COSMIC_CRISP_BASEPATH, publishTimestamp);
            expect(cosmicCrispJob.status).toBe("completed");
            console.log(
                `Cosmic Crisp reindex completed: job_id=${cosmicCrispJob.id}, num_inserted=${cosmicCrispJob.num_inserted}, completed_at=${cosmicCrispJob.completed_at}`
            );
        });

        test("wait for reindex propagation", async () => {
            console.log("Waiting 15 seconds for reindex to propagate...");
            await new Promise((resolve) => setTimeout(resolve, 15_000));
        });

        // ── Turbopuffer chunk verification ──────────────────────────────

        test("verify APPLE chunks exist in turbopuffer with correct basepath", async () => {
            const chunks = await queryTurbopufferChunks(APPLE_BASEPATH);
            console.log(`APPLE turbopuffer chunks: ${chunks.length} (job inserted ${appleJob.num_inserted})`);
            expect(chunks.length).toBeGreaterThan(0);

            for (const chunk of chunks) {
                expect(chunk.basepath).toBe(APPLE_BASEPATH);
            }

            // The reindex-test page should contain our test marker
            const reindexChunk = chunks.find((c) => c.url.includes("reindex-test"));
            expect(reindexChunk, "Expected a reindex-test chunk in APPLE basepath").toBeTruthy();
            expect(reindexChunk!.chunk).toContain(TEST_RUN_ID);
            console.log(`APPLE reindex-test chunk verified with marker ${TEST_RUN_ID}`);
        });

        test("verify BANANA chunks exist in turbopuffer with correct basepath", async () => {
            const chunks = await queryTurbopufferChunks(BANANA_BASEPATH);
            console.log(`BANANA turbopuffer chunks: ${chunks.length} (job inserted ${bananaJob.num_inserted})`);
            expect(chunks.length).toBeGreaterThan(0);

            for (const chunk of chunks) {
                expect(chunk.basepath).toBe(BANANA_BASEPATH);
            }

            // BANANA chunks should NOT contain the APPLE test marker or COSMIC_CRISP keyword
            for (const chunk of chunks) {
                expect(chunk.chunk).not.toContain(TEST_RUN_ID);
                expect(chunk.chunk.toUpperCase()).not.toContain("COSMIC_CRISP");
            }
            console.log("BANANA chunks verified: correct basepath, no APPLE/COSMIC_CRISP content");
        });

        test("verify COSMIC_CRISP chunks exist in turbopuffer with correct basepath", async () => {
            const chunks = await queryTurbopufferChunks(COSMIC_CRISP_BASEPATH);
            console.log(
                `COSMIC_CRISP turbopuffer chunks: ${chunks.length} (job inserted ${cosmicCrispJob.num_inserted})`
            );
            expect(chunks.length).toBeGreaterThan(0);

            for (const chunk of chunks) {
                expect(chunk.basepath).toBe(COSMIC_CRISP_BASEPATH);
            }

            // Should contain the SUB_REINDEX_KEYWORD
            const reindexChunk = chunks.find((c) => c.url.includes("reindex-test"));
            expect(reindexChunk, "Expected a reindex-test chunk in COSMIC_CRISP basepath").toBeTruthy();
            expect(reindexChunk!.chunk).toContain("COSMIC_CRISP");
            console.log("COSMIC_CRISP chunks verified: correct basepath with SUB_REINDEX_KEYWORD");
        });

        // ── FAI chat verification ───────────────────────────────────────

        test("FAI chat for APPLE basepath returns APPLE keyword and test marker", async () => {
            const question =
                "What is the REINDEX_KEYWORD and REINDEX_TEST_MARKER on the reindex test page? Return the exact values.";
            const response = await queryChatApi(DOMAIN, APPLE_BASEPATH, question);
            console.log(`Apple chat response: ${response}`);

            expect(response.toUpperCase()).toContain("APPLE");
            expect(response).toContain(TEST_RUN_ID);
        });

        test("FAI chat for APPLE basepath also returns COSMIC_CRISP content (hierarchical)", async () => {
            const question = "What is the SUB_REINDEX_KEYWORD on the reindex test page? Return the exact value.";
            const response = await queryChatApi(DOMAIN, APPLE_BASEPATH, question);
            console.log(`Apple chat (cosmic crisp query) response: ${response}`);

            // Parent basepath /apple should include sub-basepath /apple/cosmic-crisp content
            expect(response.toUpperCase()).toContain("COSMIC_CRISP");
        });

        test("FAI chat for BANANA basepath returns BANANA keyword (isolated from APPLE tree)", async () => {
            const question = "What is the REINDEX_KEYWORD on the reindex test page? Return the exact value.";
            const response = await queryChatApi(DOMAIN, BANANA_BASEPATH, question);
            console.log(`Banana chat response: ${response}`);

            expect(response.toUpperCase()).toContain("BANANA");
            // BANANA should NOT contain APPLE or COSMIC_CRISP content
            expect(response).not.toContain(TEST_RUN_ID);
            expect(response.toUpperCase()).not.toContain("COSMIC_CRISP");
        });

        test("FAI chat for COSMIC_CRISP basepath returns COSMIC_CRISP keyword only", async () => {
            const question = "What is the SUB_REINDEX_KEYWORD on the reindex test page? Return the exact value.";
            const response = await queryChatApi(DOMAIN, COSMIC_CRISP_BASEPATH, question);
            console.log(`Cosmic Crisp chat response: ${response}`);

            expect(response.toUpperCase()).toContain("COSMIC_CRISP");
            // COSMIC_CRISP should NOT contain the APPLE-only test marker
            expect(response).not.toContain(TEST_RUN_ID);
        });

        test.afterAll(async () => {
            // Clean up cloned repo
            if (repoDir && fs.existsSync(repoDir)) {
                fs.rmSync(repoDir, { recursive: true, force: true });
            }
        });
    });
