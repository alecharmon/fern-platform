import { expect, test } from "@playwright/test";
import { execSync } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";

/**
 * Publishes customer docs sites to the dev stack.
 * Sitemap page-level 200 checking is handled separately by Checkly
 * (playwright/checks/dev-sitemap-checks.spec.ts), which runs against
 * already-warm sites on a schedule.
 *
 * Flow (per customer):
 *   1. Clones the customer repo into a temp dir
 *   2. Publishes docs via `npx @fern-api/fern-api-dev generate --docs --no-prompt`
 *   3. Verifies sitemap.xml is reachable (200 + XML content-type)
 *
 * Requires env vars:
 *   - DEV_SMOKE_TEST_FERN_TOKEN — for publishing docs to dev stack (smoke-test org)
 */

interface CustomerConfig {
    name: string;
    repoUrl: string;
    devUrl: string;
}

const CUSTOMER_REPOS: CustomerConfig[] = [
    {
        name: "merge",
        repoUrl: "https://github.com/fern-api/merge-docs-dev.git",
        devUrl: "merge.docs.dev.buildwithfern.com"
    }
];

const hasPublishToken = !!process.env.DEV_SMOKE_TEST_FERN_TOKEN;

if (!hasPublishToken) {
    console.log("Skipping sitemap-customer-sites tests: DEV_SMOKE_TEST_FERN_TOKEN is not set");
}

for (const customer of CUSTOMER_REPOS) {
    test.describe
        .serial(`${customer.name} publish`, () => {
            test.setTimeout(1_800_000); // 30 minutes

            test.skip(!hasPublishToken, "DEV_SMOKE_TEST_FERN_TOKEN is not set");

            let repoDir: string;

            test(`clone ${customer.name} repo and publish docs`, async () => {
                repoDir = fs.mkdtempSync(path.join(os.tmpdir(), `fern-customer-${customer.name}-`));
                console.log(`Cloning ${customer.repoUrl} into ${repoDir}`);
                execSync(`git clone --depth 1 ${customer.repoUrl} ${repoDir}`, {
                    stdio: "inherit",
                    timeout: 60_000
                });

                console.log(`Publishing ${customer.name} docs to dev stack...`);
                try {
                    const output = execSync("npx @fern-api/fern-api-dev generate --docs --no-prompt", {
                        cwd: repoDir,
                        env: { ...process.env, FERN_TOKEN: process.env.DEV_SMOKE_TEST_FERN_TOKEN },
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

            test(`sitemap.xml returns 200`, async ({ request }) => {
                // Allow the deployment to settle before checking
                await new Promise((resolve) => setTimeout(resolve, 10_000));

                const siteUrl = `https://${customer.devUrl}`;
                const response = await request.get(`${siteUrl}/sitemap.xml`);
                console.log(`GET ${siteUrl}/sitemap.xml → ${response.status()}`);
                expect(response.status()).toBe(200);
                const contentType = response.headers()["content-type"] ?? "";
                expect(contentType).toContain("xml");
            });

            test.afterAll(async () => {
                if (repoDir && fs.existsSync(repoDir)) {
                    fs.rmSync(repoDir, { recursive: true, force: true });
                    console.log(`Cleaned up temp dir: ${repoDir}`);
                }
            });
        });
}
