import { expect, test } from "@playwright/test";
import { execSync } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";

/**
 * RBAC (Role-Based Access Control) chat integration test.
 *
 * Validates that FAI chat correctly enforces viewer restrictions:
 *   1. Clones fern-testing-umbrella, publishes the rbac-test docs
 *   2. Waits for the FAI reindex job to complete
 *   3. Queries FAI chat with different role tokens and verifies:
 *      - Admin token: sees admin-only and admin-and-developer keywords, NOT developer-only
 *      - Developer token: sees developer-only and admin-and-developer keywords, NOT admin-only
 *      - No token (unauthenticated): sees only public keyword, NOT any role-restricted keywords
 *
 * Each page contains a field named `RBAC_KEYWORD` with a unique value. The test asks
 * the AI "What are all the RBAC_KEYWORDs you can see?" and checks which values appear.
 *
 * Auth is password-based (configured in edge config). The test logs in with
 * "admin-pass" (admin role) and "dev-pass" (developer role) to obtain FERN_TOKENs.
 *
 * Requires env vars (set in CI via GitHub Actions secrets):
 *   - DEV_SMOKE_TEST_FERN_TOKEN  — for publishing docs (smoke-test org)
 *   - FAI_DEV_ENDPOINT_TOKEN     — for FAI reindex API calls
 *   - TURBOPUFFER_API_KEY        — for verifying chunks in turbopuffer
 *
 * To run locally:
 *   npx playwright test tests/rbac-chat.spec.ts
 */

/** Path to the locally-installed fern-dev CLI binary (avoids npm CDN race conditions with npx). */
const FERN_DEV_BIN = path.resolve(__dirname, "../node_modules/.bin/fern-dev");

const FAI_BASE_URL = "https://fai-dev2.buildwithfern.com";
const DOMAIN = "rbac-dev-test.docs.dev.buildwithfern.com";
const UMBRELLA_REPO_URL = "https://github.com/fern-api/fern-testing-umbrella.git";

const TURBOPUFFER_BASE_URL = "https://gcp-us-east4.turbopuffer.com/v2";
const TURBOPUFFER_NAMESPACE = `${DOMAIN}_query`;

// Unique keywords embedded in each page (see fern-testing-umbrella/rbac-test)
const ADMIN_KEYWORD = "RBAC_ADMIN_MAPLE";
const DEVELOPER_KEYWORD = "RBAC_DEVELOPER_CEDAR";
const BOTH_KEYWORD = "RBAC_BOTH_WILLOW";
const PUBLIC_KEYWORD = "RBAC_PUBLIC_ORCHID";

// Passwords configured in edge config for rbac-dev-test.docs.dev.buildwithfern.com
const ADMIN_PASSWORD = "admin-pass";
const DEVELOPER_PASSWORD = "dev-pass";

const hasPublishToken = !!process.env.DEV_SMOKE_TEST_FERN_TOKEN;
const hasFaiToken = !!process.env.FAI_DEV_ENDPOINT_TOKEN;
const hasTurbopufferKey = !!process.env.TURBOPUFFER_API_KEY;
const hasRequiredTokens = hasPublishToken && hasFaiToken && hasTurbopufferKey;

if (!hasPublishToken) {
    console.log("Skipping RBAC chat tests: DEV_SMOKE_TEST_FERN_TOKEN is not set");
}
if (!hasFaiToken) {
    console.log("Skipping RBAC chat tests: FAI_DEV_ENDPOINT_TOKEN is not set");
}
if (!hasTurbopufferKey) {
    console.log("Skipping RBAC chat tests: TURBOPUFFER_API_KEY is not set");
}

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
    roles?: string[];
    authed?: boolean;
    [key: string]: unknown;
}

/**
 * Query turbopuffer for all chunks in this domain's namespace.
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

/**
 * Fetch the latest reindex job for this domain.
 */
async function getLatestJob(): Promise<ReindexingJobRecord | null> {
    const response = await fetch(`${FAI_BASE_URL}/reindexing/jobs/domain/${DOMAIN}/latest`, {
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
 * Poll for a reindex job created after `afterTimestamp` to reach a terminal state.
 */
async function waitForReindex(afterTimestamp: string, timeoutMs: number = 120_000): Promise<ReindexingJobRecord> {
    const start = Date.now();
    const pollIntervalMs = 5_000;
    const afterDate = new Date(afterTimestamp);

    while (Date.now() - start < timeoutMs) {
        const job = await getLatestJob();

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
                    `Latest job (created_at=${job.created_at}) is before publish (${afterTimestamp}), waiting...`
                );
            }
        } else {
            console.log("No reindex job found yet, waiting...");
        }

        await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
    }

    throw new Error(`No reindex job created after ${afterTimestamp} within ${timeoutMs}ms`);
}

/**
 * Log in via the docs password endpoint and extract the fern_token from the Set-Cookie header.
 */
async function loginWithPassword(password: string): Promise<string> {
    const response = await fetch(`https://${DOMAIN}/api/fern-docs/auth/password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
        redirect: "manual"
    });

    if (!response.ok) {
        const text = await response.text();
        throw new Error(`Password login failed (${response.status}): ${text}`);
    }

    const setCookie = response.headers.get("set-cookie");
    if (!setCookie) {
        throw new Error("No Set-Cookie header in password login response");
    }

    const match = setCookie.match(/fern_token=([^;]+)/);
    if (!match) {
        throw new Error(`Could not extract fern_token from Set-Cookie: ${setCookie}`);
    }

    return match[1];
}

/**
 * Query FAI chat with an optional FERN_TOKEN for role-based access.
 * Uses the Vercel proxy endpoint (same as the frontend) which forwards
 * to the fai-chat service with the correct x-fern-host header.
 */
async function queryChatApi(question: string, fernToken?: string): Promise<string> {
    const headers: Record<string, string> = {
        "Content-Type": "application/json"
    };
    if (fernToken) {
        headers["Cookie"] = `fern_token=${fernToken}`;
    }

    const response = await fetch(`https://${DOMAIN}/api/fern-docs/search/v2/chat`, {
        method: "POST",
        headers,
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

// Full pipeline: publish (~3 min) + reindex (~5 min) + chat queries
test.setTimeout(900_000); // 15 minutes

test.describe
    .serial("RBAC chat verification", () => {
        test.skip(
            !hasRequiredTokens,
            "Missing required tokens: DEV_SMOKE_TEST_FERN_TOKEN, FAI_DEV_ENDPOINT_TOKEN, or TURBOPUFFER_API_KEY"
        );

        let repoDir: string;
        let publishTimestamp: string;
        let reindexJob: ReindexingJobRecord;
        let adminToken: string;
        let developerToken: string;

        test("clone umbrella repo", async () => {
            repoDir = fs.mkdtempSync(path.join(os.tmpdir(), "fern-testing-umbrella-rbac-"));
            console.log(`Cloning ${UMBRELLA_REPO_URL} into ${repoDir}`);
            execSync(`git clone --depth 1 ${UMBRELLA_REPO_URL} ${repoDir}`, {
                stdio: "inherit",
                timeout: 60_000
            });
        });

        test("publish RBAC test docs via fern-dev CLI", async () => {
            publishTimestamp = new Date().toISOString();
            console.log(`Publishing RBAC test docs... (publish timestamp: ${publishTimestamp})`);

            const output = execSync(`${FERN_DEV_BIN} generate --docs --no-prompt`, {
                cwd: path.join(repoDir, "rbac-test"),
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

        test("wait for publish-triggered reindex to complete", async () => {
            console.log("Waiting 5 seconds before polling for publish-triggered reindex...");
            await new Promise((resolve) => setTimeout(resolve, 5_000));

            reindexJob = await waitForReindex(publishTimestamp);
            expect(reindexJob.status).toBe("completed");
            console.log(
                `Reindex completed: job_id=${reindexJob.id}, num_inserted=${reindexJob.num_inserted}, completed_at=${reindexJob.completed_at}`
            );
        });

        test("wait for reindex propagation", async () => {
            console.log("Waiting 15 seconds for reindex to propagate...");
            await new Promise((resolve) => setTimeout(resolve, 15_000));
        });

        // ── Turbopuffer chunk verification ──────────────────────────────

        test("verify RBAC chunks exist in turbopuffer with role attributes", async () => {
            const chunks = await queryTurbopufferChunks();
            console.log(`RBAC turbopuffer chunks: ${chunks.length} (job inserted ${reindexJob.num_inserted})`);
            expect(chunks.length).toBeGreaterThan(0);

            // Verify role-restricted chunks have roles set
            const adminChunk = chunks.find((c) => c.chunk?.includes(ADMIN_KEYWORD));
            expect(adminChunk, `Expected a chunk containing ${ADMIN_KEYWORD}`).toBeTruthy();
            console.log(`Admin chunk roles: ${JSON.stringify(adminChunk!.roles)}, authed: ${adminChunk!.authed}`);

            const developerChunk = chunks.find((c) => c.chunk?.includes(DEVELOPER_KEYWORD));
            expect(developerChunk, `Expected a chunk containing ${DEVELOPER_KEYWORD}`).toBeTruthy();
            console.log(
                `Developer chunk roles: ${JSON.stringify(developerChunk!.roles)}, authed: ${developerChunk!.authed}`
            );

            const bothChunk = chunks.find((c) => c.chunk?.includes(BOTH_KEYWORD));
            expect(bothChunk, `Expected a chunk containing ${BOTH_KEYWORD}`).toBeTruthy();
            console.log(`Both chunk roles: ${JSON.stringify(bothChunk!.roles)}, authed: ${bothChunk!.authed}`);

            const publicChunk = chunks.find((c) => c.chunk?.includes(PUBLIC_KEYWORD));
            expect(publicChunk, `Expected a chunk containing ${PUBLIC_KEYWORD}`).toBeTruthy();
            console.log(`Public chunk roles: ${JSON.stringify(publicChunk!.roles)}, authed: ${publicChunk!.authed}`);
        });

        // ── Obtain FERN_TOKENs via password login ────────────────────────

        test("login with admin password to get FERN_TOKEN", async () => {
            adminToken = await loginWithPassword(ADMIN_PASSWORD);
            console.log(`Admin token obtained (length=${adminToken.length})`);
            expect(adminToken).toBeTruthy();
        });

        test("login with developer password to get FERN_TOKEN", async () => {
            developerToken = await loginWithPassword(DEVELOPER_PASSWORD);
            console.log(`Developer token obtained (length=${developerToken.length})`);
            expect(developerToken).toBeTruthy();
        });

        // ── FAI chat RBAC verification ──────────────────────────────────

        const RBAC_QUESTION = "What are all of the RBAC_KEYWORDs you can see? List each exact value.";

        test("admin token: sees admin-only and both-role keywords, not developer-only", async () => {
            const response = await queryChatApi(RBAC_QUESTION, adminToken);
            console.log(`Admin token response: ${response}`);
            const upper = response.toUpperCase();

            expect(upper).toContain(ADMIN_KEYWORD);
            expect(upper).toContain(BOTH_KEYWORD);
            expect(upper).toContain(PUBLIC_KEYWORD);
            expect(upper).not.toContain(DEVELOPER_KEYWORD);
        });

        test("developer token: sees developer-only and both-role keywords, not admin-only", async () => {
            const response = await queryChatApi(RBAC_QUESTION, developerToken);
            console.log(`Developer token response: ${response}`);
            const upper = response.toUpperCase();

            expect(upper).toContain(DEVELOPER_KEYWORD);
            expect(upper).toContain(BOTH_KEYWORD);
            expect(upper).toContain(PUBLIC_KEYWORD);
            expect(upper).not.toContain(ADMIN_KEYWORD);
        });

        test("unauthenticated: sees only public keyword, not any role-restricted keywords", async () => {
            const response = await queryChatApi(RBAC_QUESTION);
            console.log(`Unauthenticated response: ${response}`);
            const upper = response.toUpperCase();

            expect(upper).toContain(PUBLIC_KEYWORD);
            expect(upper).not.toContain(ADMIN_KEYWORD);
            expect(upper).not.toContain(DEVELOPER_KEYWORD);
            expect(upper).not.toContain(BOTH_KEYWORD);
        });

        test.afterAll(async () => {
            // Clean up cloned repo
            if (repoDir && fs.existsSync(repoDir)) {
                fs.rmSync(repoDir, { recursive: true, force: true });
            }
        });
    });
