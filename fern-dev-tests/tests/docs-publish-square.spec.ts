import { expect, test } from "@playwright/test";
import { execSync } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";
import { compareScreenshot } from "../utils/visual-regression";

/**
 * End-to-end publish test for docs using the Fern CLI.
 *
 * Clones fern-api/fern-testing-square, runs `fern-dev generate --docs --no-prompt`,
 * then verifies the deployed site is live and takes a visual regression screenshot.
 *
 * Requires:
 *   - FERN_TOKEN env var (set via FERN_DEV_ORG_TESTING_TOKEN secret in CI)
 *   - git (to clone the fixture repo)
 *   - npx fern-dev (installed via @fern-api/fern-api-dev devDependency)
 *
 * To run locally:
 *   export FERN_TOKEN=<your-dev-token>
 *   npx playwright test tests/docs-publish-square.spec.ts
 *
 * If FERN_TOKEN is not set, the entire suite is skipped.
 */

const REPO_URL = "https://github.com/fern-api/fern-testing-square.git";
const DEPLOYED_URL = "https://square-test.docs.dev.buildwithfern.com";

// Publishing can take several minutes
test.setTimeout(600_000); // 10 minutes

// Skip the entire suite if FERN_TOKEN is not set (e.g. running locally without a token)
const hasFernToken = !!process.env.FERN_TOKEN;

if (!hasFernToken) {
    console.log("Skipping square docs publish tests: FERN_TOKEN is not set");
}

test.describe
    .serial("square docs publish", () => {
        // Temporarily disabled — git clone of fern-testing-square is flaky in CI
        test.skip(true, "square publish test is temporarily disabled");
        test.skip(!hasFernToken, "FERN_TOKEN is not set");

        let repoDir: string;

        test.beforeAll(async () => {
            // Clone the fixture repo into a temp directory
            repoDir = fs.mkdtempSync(path.join(os.tmpdir(), "fern-testing-square-"));
            console.log(`Cloning ${REPO_URL} into ${repoDir}`);
            execSync(`git clone --depth 1 ${REPO_URL} ${repoDir}`, {
                stdio: "inherit",
                timeout: 60_000
            });
        });

        test.afterAll(async () => {
            // Clean up cloned repo
            if (repoDir && fs.existsSync(repoDir)) {
                fs.rmSync(repoDir, { recursive: true, force: true });
            }
        });

        test("fern-dev generate --docs --no-prompt succeeds", async () => {
            console.log("Running: fern-dev generate --docs --no-prompt");

            const output = execSync("npx fern-dev generate --docs --no-prompt", {
                cwd: repoDir,
                timeout: 540_000, // 9 minutes
                env: {
                    ...process.env,
                    FERN_TOKEN: process.env.FERN_TOKEN
                },
                encoding: "utf-8",
                stdio: ["pipe", "pipe", "pipe"]
            });

            console.log("fern-dev generate output:", output);
        });

        test("deployed site returns 200", async ({ request }) => {
            // Wait a bit for the deployment to propagate
            await new Promise((resolve) => setTimeout(resolve, 10_000));

            const response = await request.get(DEPLOYED_URL);
            expect(response.status()).toBe(200);
        });

        test("deployed site visual regression", async ({ page }) => {
            await page.goto(DEPLOYED_URL, { waitUntil: "networkidle" });
            await compareScreenshot(page, {
                name: "square-test-front-page",
                fullPage: true,
                waitAfterLoad: 2000
            });
        });
    });
