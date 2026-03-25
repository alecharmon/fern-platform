import { expect, test } from "@playwright/test";
import { execSync } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";

import { compareScreenshot } from "../utils/visual-regression";

/**
 * Publishes and visually inspects a non-basepath-aware subpath deployment,
 * then verifies that publish auto-triggers a reindex with the correct content.
 *
 * Flow:
 *   1. Clones fern-testing-umbrella, appends a unique marker to welcome page
 *   2. Publishes normal-subpath-repo to normal-subpath-smoke-test.docs.dev.buildwithfern.com/subpath
 *   3. Verifies the deployed site returns 200
 *   4. Takes visual regression screenshots
 *   5. Polls for an auto-triggered reindex job created after publish
 *   6. Verifies turbopuffer chunks contain the unique marker
 *
 * Requires env vars:
 *   - DEV_SMOKE_TEST_FERN_TOKEN — for publishing docs (smoke-test org)
 *   - FAI_DEV_ENDPOINT_TOKEN    — for checking reindex job status
 *   - TURBOPUFFER_API_KEY       — for verifying chunks
 */

/** Path to the locally-installed fern-dev CLI binary (avoids npm CDN race conditions with npx). */
const FERN_DEV_BIN = path.resolve(__dirname, "../node_modules/.bin/fern-dev");

const FAI_BASE_URL = "https://fai-dev2.buildwithfern.com";
const DOMAIN = "normal-subpath-smoke-test.docs.dev.buildwithfern.com";
const SUBPATH = "/subpath";
const SITE_URL = `https://${DOMAIN}${SUBPATH}`;
const UMBRELLA_REPO_URL = "https://github.com/fern-api/fern-testing-umbrella.git";
const UMBRELLA_PROJECT_DIR = "normal-subpath-repo";

const TURBOPUFFER_BASE_URL = "https://gcp-us-east4.turbopuffer.com/v2";
const TURBOPUFFER_NAMESPACE = `${DOMAIN}_query`;

const hasPublishToken = !!process.env.DEV_SMOKE_TEST_FERN_TOKEN;
const hasFaiToken = !!process.env.FAI_DEV_ENDPOINT_TOKEN;
const hasTurbopufferKey = !!process.env.TURBOPUFFER_API_KEY;
const hasRequiredTokens = hasPublishToken && hasFaiToken && hasTurbopufferKey;

if (!hasPublishToken) {
    console.log("Skipping normal-subpath-publish tests: DEV_SMOKE_TEST_FERN_TOKEN is not set");
}
if (!hasFaiToken) {
    console.log("Skipping normal-subpath-publish tests: FAI_DEV_ENDPOINT_TOKEN is not set");
}
if (!hasTurbopufferKey) {
    console.log("Skipping normal-subpath-publish tests: TURBOPUFFER_API_KEY is not set");
}

const TEST_RUN_ID = `TEST_RUN_${Date.now()}`;

interface ReindexingJobRecord {
    id: string;
    domain: string;
    basepath: string;
    status: string;
    error?: string;
    num_inserted?: number;
    created_at: string;
    completed_at?: string;
}

interface TurbopufferRow {
    id: string;
    basepath: string;
    chunk: string;
    [key: string]: unknown;
}

/**
 * Fetch the latest reindex job for a domain (no basepath filter for non-basepath-aware sites).
 */
async function getLatestJob(domain: string): Promise<ReindexingJobRecord | null> {
    const response = await fetch(`${FAI_BASE_URL}/reindexing/jobs/domain/${domain}/latest`, {
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
 * Poll the latest reindex job until one created after `afterTimestamp` completes.
 */
async function waitForAutoReindex(
    domain: string,
    afterTimestamp: string,
    timeoutMs: number = 120_000
): Promise<ReindexingJobRecord> {
    const start = Date.now();
    const pollIntervalMs = 5_000;
    const afterDate = new Date(afterTimestamp);

    while (Date.now() - start < timeoutMs) {
        const job = await getLatestJob(domain);

        if (job) {
            const jobCreated = new Date(job.created_at);
            if (jobCreated >= afterDate) {
                console.log(`Found reindex job ${job.id}: status=${job.status}, created_at=${job.created_at}`);

                if (job.status === "completed") {
                    return job;
                }

                if (job.status === "failed") {
                    throw new Error(`Reindex job ${job.id} failed: ${job.error ?? "unknown error"}`);
                }
            } else {
                console.log(
                    `Latest job created_at=${job.created_at} is before publish (${afterTimestamp}), waiting...`
                );
            }
        } else {
            console.log(`No reindex job found yet, waiting...`);
        }

        await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
    }

    throw new Error(`No reindex job created after ${afterTimestamp} for ${domain} within ${timeoutMs}ms`);
}

/**
 * Query turbopuffer for all chunks in the namespace.
 */
async function queryTurbopufferChunks(): Promise<TurbopufferRow[]> {
    const response = await fetch(`${TURBOPUFFER_BASE_URL}/namespaces/${TURBOPUFFER_NAMESPACE}/query`, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${process.env.TURBOPUFFER_API_KEY}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            rank_by: ["id", "asc"],
            top_k: 100,
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

test.setTimeout(600_000); // 10 minutes

test.describe
    .serial("normal subpath publish + visual inspection", () => {
        test.skip(
            !hasRequiredTokens,
            "DEV_SMOKE_TEST_FERN_TOKEN, FAI_DEV_ENDPOINT_TOKEN, or TURBOPUFFER_API_KEY is not set"
        );

        let repoDir: string;
        let publishTimestamp: string;

        test("clone umbrella repo and update content with unique marker", async () => {
            repoDir = fs.mkdtempSync(path.join(os.tmpdir(), "fern-testing-umbrella-"));
            console.log(`Cloning ${UMBRELLA_REPO_URL} into ${repoDir}`);
            execSync(`git clone --depth 1 ${UMBRELLA_REPO_URL} ${repoDir}`, {
                stdio: "inherit",
                timeout: 60_000
            });

            const welcomeFile = path.join(repoDir, UMBRELLA_PROJECT_DIR, "fern/docs/pages/welcome.mdx");
            const existingContent = fs.readFileSync(welcomeFile, "utf-8");
            const updatedContent = existingContent + `\n\nNORMAL_SUBPATH_TEST_MARKER: ${TEST_RUN_ID}\n`;
            fs.writeFileSync(welcomeFile, updatedContent);
            console.log(`Updated ${welcomeFile} with marker: ${TEST_RUN_ID}`);
        });

        test("publish normal-subpath-repo via fern-dev CLI", async () => {
            publishTimestamp = new Date().toISOString();
            console.log(
                `Publishing ${UMBRELLA_PROJECT_DIR} to ${SITE_URL}... (publish timestamp: ${publishTimestamp})`
            );

            try {
                const output = execSync(`${FERN_DEV_BIN} generate --docs --no-prompt`, {
                    cwd: path.join(repoDir, UMBRELLA_PROJECT_DIR),
                    timeout: 300_000,
                    env: {
                        ...process.env,
                        FERN_TOKEN: process.env.DEV_SMOKE_TEST_FERN_TOKEN
                    },
                    encoding: "utf-8"
                });
                console.log("fern-dev generate output:", output);
            } catch (e: unknown) {
                const err = e as { stdout?: string; stderr?: string };
                console.log("fern-dev generate stdout:", err.stdout);
                console.log("fern-dev generate stderr:", err.stderr);
                throw e;
            }
        });

        test("deployed site returns 200", async ({ request }) => {
            const response = await request.get(SITE_URL);
            console.log(`GET ${SITE_URL} → ${response.status()}`);
            expect(response.status()).toBe(200);
        });

        test("subpath navigation works (About page)", async ({ page }) => {
            await page.goto(`${SITE_URL}/about`, { waitUntil: "networkidle" });
            const heading = page.locator("h1#about");
            await expect(heading).toContainText("About");
            await compareScreenshot(page, {
                name: "normal-subpath-about-page",
                maxDiffRatio: 0.05
            });
        });

        test("publish auto-triggered a reindex job", async () => {
            console.log("Waiting 5 seconds before polling for auto-triggered reindex...");
            await new Promise((resolve) => setTimeout(resolve, 5_000));

            const job = await waitForAutoReindex(DOMAIN, publishTimestamp);
            expect(job.status).toBe("completed");
            console.log(
                `Auto-triggered reindex completed: job_id=${job.id}, num_inserted=${job.num_inserted}, completed_at=${job.completed_at}`
            );
        });

        test("verify chunks contain test marker", async () => {
            // Wait for propagation
            await new Promise((resolve) => setTimeout(resolve, 15_000));

            const chunks = await queryTurbopufferChunks();
            console.log(`Turbopuffer chunks: ${chunks.length}`);
            expect(chunks.length).toBeGreaterThan(0);

            const markerChunk = chunks.find((c) => c.chunk.includes(TEST_RUN_ID));
            expect(markerChunk, `Expected a chunk containing the test marker ${TEST_RUN_ID}`).toBeTruthy();
            console.log(`Chunk verified with marker ${TEST_RUN_ID}`);
        });

        test.afterAll(async () => {
            if (repoDir && fs.existsSync(repoDir)) {
                fs.rmSync(repoDir, { recursive: true, force: true });
            }
        });
    });
