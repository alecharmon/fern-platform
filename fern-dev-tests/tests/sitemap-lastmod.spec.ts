import { expect, test } from "@playwright/test";
import { execSync } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";

/**
 * Verifies that sitemap.xml is generated with <lastmod> timestamps and that
 * lastmods update correctly when markdown content changes between publishes.
 *
 * Flow:
 *   1. Clones fern-testing-umbrella and publishes normal-subpath-repo for a baseline
 *   2. Verifies sitemap.xml is present with XML content-type
 *   3. Verifies all markdown pages in the sitemap have a <lastmod>
 *   4. Updates welcome.mdx with new content and republishes
 *   5. Verifies the modified page's lastmod is newer in the updated sitemap
 *   6. Verifies unmodified pages retained their original lastmod
 *
 * Requires env vars:
 *   - DEV_SMOKE_TEST_FERN_TOKEN — for publishing docs (smoke-test org)
 */

const DOMAIN = "normal-subpath-smoke-test.docs.dev.buildwithfern.com";
const SUBPATH = "/subpath";
const SITE_URL = `https://${DOMAIN}${SUBPATH}`;
const UMBRELLA_REPO_URL = "https://github.com/fern-api/fern-testing-umbrella.git";
const UMBRELLA_PROJECT_DIR = "normal-subpath-repo";
const WELCOME_MDX_PATH = path.join(UMBRELLA_PROJECT_DIR, "fern/docs/pages/welcome.mdx");

const hasPublishToken = !!process.env.DEV_SMOKE_TEST_FERN_TOKEN;

if (!hasPublishToken) {
    console.log("Skipping sitemap-lastmod tests: DEV_SMOKE_TEST_FERN_TOKEN is not set");
}

interface SitemapEntry {
    url: string;
    lastmod?: string;
}

function parseSitemap(xml: string): SitemapEntry[] {
    const entries: SitemapEntry[] = [];
    const urlPattern = /<url>([\s\S]*?)<\/url>/g;
    let match;
    while ((match = urlPattern.exec(xml)) !== null) {
        const block = match[1]!;
        const locMatch = /<loc>(.*?)<\/loc>/.exec(block);
        const lastmodMatch = /<lastmod>(.*?)<\/lastmod>/.exec(block);
        if (locMatch) {
            entries.push({
                url: locMatch[1]!,
                lastmod: lastmodMatch?.[1]
            });
        }
    }
    return entries;
}

function publishDocs(projectDir: string): void {
    try {
        const output = execSync("npx @fern-api/fern-api-dev generate --docs --no-prompt", {
            cwd: projectDir,
            timeout: 300_000,
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
}

test.setTimeout(600_000); // 10 minutes

test.describe
    .serial("sitemap.xml lastmod generation", () => {
        test.skip(!hasPublishToken, "DEV_SMOKE_TEST_FERN_TOKEN is not set");

        let repoDir: string;
        let firstSitemapEntries: SitemapEntry[] = [];

        test("clone umbrella repo and publish baseline", async () => {
            repoDir = fs.mkdtempSync(path.join(os.tmpdir(), "fern-testing-umbrella-"));
            console.log(`Cloning ${UMBRELLA_REPO_URL} into ${repoDir}`);
            execSync(`git clone --depth 1 ${UMBRELLA_REPO_URL} ${repoDir}`, {
                stdio: "inherit",
                timeout: 60_000
            });

            console.log(`Publishing baseline to ${SITE_URL}...`);
            publishDocs(path.join(repoDir, UMBRELLA_PROJECT_DIR));
        });

        test("deployed site returns 200", async ({ request }) => {
            // Allow a brief settling period after publish
            await new Promise((resolve) => setTimeout(resolve, 10_000));

            const response = await request.get(SITE_URL);
            console.log(`GET ${SITE_URL} → ${response.status()}`);
            expect(response.status()).toBe(200);
        });

        test("sitemap.xml returns 200 with XML content-type", async ({ request }) => {
            const response = await request.get(`${SITE_URL}/sitemap.xml`);
            console.log(`GET ${SITE_URL}/sitemap.xml → ${response.status()}`);
            expect(response.status()).toBe(200);
            const contentType = response.headers()["content-type"] ?? "";
            expect(contentType).toContain("xml");
        });

        test("all markdown pages in sitemap.xml have <lastmod>", async ({ request }) => {
            const response = await request.get(`${SITE_URL}/sitemap.xml`);
            expect(response.status()).toBe(200);
            const xml = await response.text();

            firstSitemapEntries = parseSitemap(xml);
            console.log(`Parsed ${firstSitemapEntries.length} sitemap entries:`);
            expect(firstSitemapEntries.length).toBeGreaterThan(0);

            for (const entry of firstSitemapEntries) {
                console.log(`  ${entry.url} → lastmod=${entry.lastmod ?? "(none)"}`);
                expect(entry.lastmod, `Expected <lastmod> for ${entry.url}`).toBeDefined();
            }
        });

        test("lastmod updates for the modified page after republishing", async ({ request }) => {
            // Wait at least 1s so the new lastmod is strictly newer than the baseline
            await new Promise((resolve) => setTimeout(resolve, 2_000));

            const welcomeFile = path.join(repoDir, WELCOME_MDX_PATH);
            const original = fs.readFileSync(welcomeFile, "utf-8");
            fs.writeFileSync(welcomeFile, original + `\n\n<!-- sitemap-lastmod-test: ${Date.now()} -->\n`);
            console.log(`Updated ${welcomeFile} with new content`);

            console.log("Republishing...");
            publishDocs(path.join(repoDir, UMBRELLA_PROJECT_DIR));

            // Wait for revalidation to propagate before re-fetching the sitemap
            await new Promise((resolve) => setTimeout(resolve, 15_000));

            const response = await request.get(`${SITE_URL}/sitemap.xml`);
            expect(response.status()).toBe(200);
            const xml = await response.text();
            const updatedEntries = parseSitemap(xml);

            const firstByUrl = new Map(firstSitemapEntries.map((e) => [e.url, e]));
            const changedUrls: string[] = [];

            for (const updated of updatedEntries) {
                const before = firstByUrl.get(updated.url);
                if (before?.lastmod && updated.lastmod && new Date(updated.lastmod) > new Date(before.lastmod)) {
                    changedUrls.push(updated.url);
                    console.log(
                        `  CHANGED: ${updated.url}\n    before: ${before.lastmod}\n    after:  ${updated.lastmod}`
                    );
                }
            }

            expect(
                changedUrls.length,
                "Expected at least one page to have an updated lastmod after republishing with changed markdown content"
            ).toBeGreaterThan(0);
        });

        test("unmodified pages retain their original lastmod after republish", async ({ request }) => {
            const response = await request.get(`${SITE_URL}/sitemap.xml`);
            expect(response.status()).toBe(200);
            const xml = await response.text();
            const updatedEntries = parseSitemap(xml);

            const firstByUrl = new Map(firstSitemapEntries.map((e) => [e.url, e]));
            const unchangedUrls: string[] = [];

            for (const updated of updatedEntries) {
                const before = firstByUrl.get(updated.url);
                if (before?.lastmod && updated.lastmod && new Date(updated.lastmod) <= new Date(before.lastmod)) {
                    unchangedUrls.push(updated.url);
                    console.log(`  unchanged: ${updated.url} (${updated.lastmod})`);
                }
            }

            // Only welcome.mdx was changed — at least some pages should be unchanged
            expect(
                unchangedUrls.length,
                "Expected unmodified pages to retain their original lastmod (only welcome.mdx was changed)"
            ).toBeGreaterThan(0);
            console.log(`${unchangedUrls.length} page(s) retained their original lastmod`);
        });

        test("all pages in updated sitemap still have <lastmod>", async ({ request }) => {
            const response = await request.get(`${SITE_URL}/sitemap.xml`);
            expect(response.status()).toBe(200);
            const xml = await response.text();
            const entries = parseSitemap(xml);

            expect(entries.length).toBeGreaterThan(0);
            for (const entry of entries) {
                expect(entry.lastmod, `Expected <lastmod> for ${entry.url} after republish`).toBeDefined();
            }
            console.log(`All ${entries.length} page(s) have <lastmod> after republish`);
        });

        test.afterAll(async () => {
            if (repoDir && fs.existsSync(repoDir)) {
                fs.rmSync(repoDir, { recursive: true, force: true });
            }
        });
    });
