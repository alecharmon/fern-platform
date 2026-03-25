import { expect, test } from "@playwright/test";
import { execSync } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";
import { compareScreenshot } from "../utils/visual-regression";

/**
 * End-to-end publish test for docs using the Fern CLI.
 *
 * Clones fern-api/fern-testing-square, injects a unique marker into a page,
 * publishes via `fern-dev generate --docs`, then verifies the deployed site
 * is live and contains the marker in the rendered page content.
 *
 * Requires:
 *   - DEV_SMOKE_TEST_FERN_TOKEN env var
 *
 * To run locally:
 *   npx playwright test tests/docs-publish-square.spec.ts
 */

/** Path to the locally-installed fern-dev CLI binary (avoids npm CDN race conditions with npx). */
const FERN_DEV_BIN = path.resolve(__dirname, "../node_modules/.bin/fern-dev");

const REPO_URL = "https://github.com/fern-api/fern-testing-square.git";
const DEPLOYED_URL = "https://square-smoke-test.docs.dev.buildwithfern.com";

const hasPublishToken = !!process.env.DEV_SMOKE_TEST_FERN_TOKEN;

if (!hasPublishToken) {
    console.log("Skipping square docs publish tests: DEV_SMOKE_TEST_FERN_TOKEN is not set");
}

const TEST_RUN_ID = `TEST_RUN_${Date.now()}`;

// Publishing can take several minutes
test.setTimeout(600_000); // 10 minutes

test.describe
    .serial("square docs publish", () => {
        test.skip(true, "square publish test is temporarily disabled");
        test.skip(!hasPublishToken, "DEV_SMOKE_TEST_FERN_TOKEN is not set");

        let repoDir: string;

        test("clone repo and inject unique marker", async () => {
            repoDir = fs.mkdtempSync(path.join(os.tmpdir(), "fern-testing-square-"));
            console.log(`Cloning ${REPO_URL} into ${repoDir}`);
            execSync(`git clone --depth 1 ${REPO_URL} ${repoDir}`, {
                stdio: "inherit",
                timeout: 60_000
            });

            // Inject a unique marker into the getting started page
            const targetPage = path.join(repoDir, "fern/docs/pages/square-get-started.mdx");
            const existingContent = fs.readFileSync(targetPage, "utf-8");
            const updatedContent = existingContent + `\n\n${TEST_RUN_ID}\n`;
            fs.writeFileSync(targetPage, updatedContent);
            console.log(`Injected marker ${TEST_RUN_ID} into ${targetPage}`);
        });

        test("fern-dev generate --docs --no-prompt succeeds", async () => {
            console.log("Running: fern-dev generate --docs --no-prompt");

            try {
                const output = execSync(`${FERN_DEV_BIN} generate --docs --no-prompt`, {
                    cwd: repoDir,
                    timeout: 540_000, // 9 minutes
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
            await new Promise((resolve) => setTimeout(resolve, 30_000));

            const response = await request.get(DEPLOYED_URL);
            console.log(`GET ${DEPLOYED_URL} → ${response.status()}`);
            expect(response.status()).toBe(200);
        });

        test("deployed page contains unique marker", async ({ page }) => {
            await page.goto(`${DEPLOYED_URL}/get-started`, { waitUntil: "networkidle" });
            const content = await page.textContent("body");
            console.log(`Checking page content for marker ${TEST_RUN_ID}...`);
            expect(content).toContain(TEST_RUN_ID);
            console.log("Marker found in deployed page content");
        });

        test("deployed site visual regression", async ({ page }) => {
            await page.goto(DEPLOYED_URL, { waitUntil: "networkidle" });
            await compareScreenshot(page, {
                name: "square-test-front-page",
                fullPage: true,
                waitAfterLoad: 2000
            });
        });

        test.afterAll(async () => {
            if (repoDir && fs.existsSync(repoDir)) {
                fs.rmSync(repoDir, { recursive: true, force: true });
            }
        });
    });
