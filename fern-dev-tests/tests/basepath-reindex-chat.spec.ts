import { expect, test } from "@playwright/test";
import { execSync } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";

/**
 * Basepath-aware reindexing + FAI chat integration test.
 *
 * Validates the full reindex pipeline with basepath isolation:
 *   1. Clones fern-testing-umbrella, updates the APPLE basepath's content
 *      with a unique timestamp keyword
 *   2. Publishes the updated APPLE docs via `fern-dev generate --docs`
 *   3. Triggers FAI reindex for both APPLE and BANANA basepaths
 *   4. Polls until both reindex jobs complete
 *   5. Queries FAI chat for each basepath and verifies:
 *      - APPLE returns the new timestamp keyword
 *      - BANANA returns its own distinct keyword (not APPLE's)
 *
 * Requires env vars (set in CI via GitHub Actions secrets):
 *   - DEV_SMOKE_TEST_FERN_TOKEN — for publishing docs (smoke-test org)
 *   - FAI_DEV_ENDPOINT_TOKEN    — for FAI reindex/chat API calls
 *
 * To run locally:
 *   export DEV_SMOKE_TEST_FERN_TOKEN=<your-smoke-test-token>
 *   export FAI_DEV_ENDPOINT_TOKEN=<your-fai-dev-token>
 *   npx playwright test tests/basepath-reindex-chat.spec.ts
 */

const FAI_BASE_URL = "https://fai-dev2.buildwithfern.com";
const FAI_CHAT_BASE_URL = "https://fai-chat-dev2.buildwithfern.com";
const DOMAIN = "fruits.docs.dev.buildwithfern.com";
const UMBRELLA_REPO_URL = "https://github.com/fern-api/fern-testing-umbrella.git";

const APPLE_BASEPATH = "/apple";
const BANANA_BASEPATH = "/banana";

const hasPublishToken = !!process.env.DEV_SMOKE_TEST_FERN_TOKEN;
const hasFaiToken = !!process.env.FAI_DEV_ENDPOINT_TOKEN;
const hasRequiredTokens = hasPublishToken && hasFaiToken;

if (!hasPublishToken) {
    console.log("Skipping basepath reindex chat tests: DEV_SMOKE_TEST_FERN_TOKEN is not set");
}
if (!hasFaiToken) {
    console.log("Skipping basepath reindex chat tests: FAI_DEV_ENDPOINT_TOKEN is not set");
}

// Unique marker so we can verify the freshly-indexed content
const TEST_RUN_ID = `TEST_RUN_${Date.now()}`;

interface ReindexingJobRecord {
    id: string;
    domain: string;
    basepath: string;
    status: string;
    error?: string;
    created_at: string;
    updated_at: string;
    completed_at?: string;
}

/**
 * Trigger a reindex via the FAI API and return the job ID.
 */
async function triggerReindex(domain: string, basepath: string): Promise<string> {
    const params = new URLSearchParams({ domain, basepath });

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

    console.log(`Reindex triggered for ${domain}${basepath}: job_id=${result.job_id}`);
    return result.job_id;
}

/**
 * Poll a reindex job by ID until it reaches a terminal state.
 */
async function waitForJobComplete(jobId: string, timeoutMs: number = 300_000): Promise<ReindexingJobRecord> {
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
        test.skip(!hasRequiredTokens, "DEV_SMOKE_TEST_FERN_TOKEN or FAI_DEV_ENDPOINT_TOKEN is not set");

        let repoDir: string;
        let appleJobId: string;
        let bananaJobId: string;

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
            console.log("Publishing APPLE docs...");

            const output = execSync("npx fern-dev generate --docs --no-prompt", {
                cwd: path.join(repoDir, "fruits-apple"),
                timeout: 300_000, // 5 minutes
                env: {
                    ...process.env,
                    FERN_TOKEN: process.env.DEV_SMOKE_TEST_FERN_TOKEN
                },
                encoding: "utf-8",
                stdio: ["pipe", "pipe", "pipe"]
            });

            console.log("fern-dev generate output:", output);
        });

        test("trigger reindex for both APPLE and BANANA basepaths", async () => {
            appleJobId = await triggerReindex(DOMAIN, APPLE_BASEPATH);
            bananaJobId = await triggerReindex(DOMAIN, BANANA_BASEPATH);
            console.log(`Apple job: ${appleJobId}, Banana job: ${bananaJobId}`);
        });

        test("wait for APPLE reindex to complete", async () => {
            const job = await waitForJobComplete(appleJobId);
            expect(job.status).toBe("completed");
            console.log(`Apple reindex completed: ${JSON.stringify(job)}`);
        });

        test("wait for BANANA reindex to complete", async () => {
            const job = await waitForJobComplete(bananaJobId);
            expect(job.status).toBe("completed");
            console.log(`Banana reindex completed: ${JSON.stringify(job)}`);
        });

        test("FAI chat for APPLE basepath returns APPLE keyword and test marker", async () => {
            const question =
                "What is the REINDEX_KEYWORD and REINDEX_TEST_MARKER on the reindex test page? Return the exact values.";
            const response = await queryChatApi(DOMAIN, APPLE_BASEPATH, question);
            console.log(`Apple chat response: ${response}`);

            // The response should contain APPLE keyword
            expect(response.toUpperCase()).toContain("APPLE");
            // The response should contain our unique test marker
            expect(response).toContain(TEST_RUN_ID);
        });

        test("FAI chat for BANANA basepath returns BANANA keyword (not APPLE)", async () => {
            const question = "What is the REINDEX_KEYWORD on the reindex test page? Return the exact value.";
            const response = await queryChatApi(DOMAIN, BANANA_BASEPATH, question);
            console.log(`Banana chat response: ${response}`);

            // The response should contain BANANA keyword
            expect(response.toUpperCase()).toContain("BANANA");
            // The response should NOT contain our test marker (only APPLE was updated)
            expect(response).not.toContain(TEST_RUN_ID);
        });

        test.afterAll(async () => {
            // Clean up cloned repo
            if (repoDir && fs.existsSync(repoDir)) {
                fs.rmSync(repoDir, { recursive: true, force: true });
            }
        });
    });
