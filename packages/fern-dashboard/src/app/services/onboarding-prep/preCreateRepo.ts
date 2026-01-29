"use server";

import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";

import { RedisCacheKey } from "@/app/services/redis/cacheKey";
import { redisGet, redisSet } from "@/app/services/redis/redis";
import { getDemoCreationBotOctokit } from "../auth0/fernBotOctokit";
import { setFernTokenSecret } from "../dal/github/setFernTokenSecret";
import { triggerWorkflow } from "../dal/github/triggerWorkflow";
import { getGitLoader } from "../github/getGitLoader";

const DEMO_BOT_OWNER = process.env.FERN_DEMO_CREATION_BOT_OWNER;

/**
 * Check if a GitHub repository exists
 */
async function repoExists(owner: string, repoName: string): Promise<boolean> {
    const octokitResult = getDemoCreationBotOctokit();
    if (!octokitResult.ok) {
        return false;
    }

    try {
        await octokitResult.octokit.request("GET /repos/{owner}/{repo}", {
            owner,
            repo: repoName
        });
        return true;
    } catch {
        return false;
    }
}

/**
 * Generate a random 6-digit number string
 */
function generateRandomSuffix(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

// TTL for pre-create status in Redis: 2 hours
// Allows users time to complete onboarding and add collaborators
const PRE_CREATE_TTL_SECONDS = 60 * 60 * 2;

export interface PreCreateRepoParams {
    orgName: string;
    accessToken: string;
}

export interface PreCreateRepoResult {
    success: boolean;
    repoUrl?: string;
    repoName?: string;
    fernTokenSet?: boolean;
    error?: string;
}

/**
 * Pre-creates a GitHub repository with generic docs-starter content for faster onboarding.
 *
 * Flow:
 * 1. Create repo with all files in one commit (README, fern config, workflow, generic docs)
 * 2. Set FERN_TOKEN as GitHub secret + wait 5 seconds
 * 3. Manually trigger the workflow via workflow_dispatch
 *
 * Later, the publish route pushes customized content which triggers another workflow run.
 */
export async function preCreateRepo(params: PreCreateRepoParams): Promise<PreCreateRepoResult> {
    const { orgName, accessToken } = params;

    if (!DEMO_BOT_OWNER) {
        console.error("[preCreateRepo] FERN_DEMO_CREATION_BOT_OWNER not set");
        return { success: false, error: "Demo bot owner not configured" };
    }

    // Check if already in progress or completed
    const existingStatus = await redisGet(RedisCacheKey.onboardingPreCreate(orgName));
    if (existingStatus && (existingStatus.status === "in_progress" || existingStatus.status === "completed")) {
        console.log(`[preCreateRepo] Pre-create already ${existingStatus.status} for ${orgName}`);
        return {
            success: existingStatus.status === "completed",
            repoUrl: existingStatus.repoUrl,
            repoName: existingStatus.repoName,
            fernTokenSet: existingStatus.fernTokenSet
        };
    }

    // Mark as in progress
    await redisSet(
        RedisCacheKey.onboardingPreCreate(orgName),
        {
            status: "in_progress",
            startedAt: Date.now()
        },
        { ttlInSeconds: PRE_CREATE_TTL_SECONDS }
    );

    let tempDir: string | null = null;

    try {
        // Use orgName as the base repo name
        const baseRepoName = orgName.replace(/[^a-zA-Z0-9-]/g, "-").toLowerCase();

        // Generate docs URL from org name
        const docsUrl = `${baseRepoName}.docs.buildwithfern.com`;

        // Create temp dir with full fern structure for token generation
        // (fern token requires docs.yml to exist)
        tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "fern-precreate-"));
        const fernDir = path.join(tempDir, "fern");
        const docsDir = path.join(fernDir, "docs", "pages");
        await fs.mkdir(docsDir, { recursive: true });

        // Write fern.config.json
        await fs.writeFile(
            path.join(fernDir, "fern.config.json"),
            JSON.stringify({ organization: orgName, version: "*" }, null, 2)
        );

        // Write docs.yml (required for fern token command)
        await fs.writeFile(
            path.join(fernDir, "docs.yml"),
            `instances:
  - url: ${docsUrl}

title: ${orgName} | Documentation

colors:
  accent-primary:
    dark: "#70E155"
    light: "#008700"

navigation:
  - section: Documentation
    contents:
      - page: Welcome
        path: docs/pages/welcome.mdx
`
        );

        // Write welcome.mdx
        await fs.writeFile(
            path.join(docsDir, "welcome.mdx"),
            `---
title: Welcome
---

# Welcome to ${orgName}

Your documentation site is being set up. Once complete, this page will be replaced with your customized content.

## What's Next?

Complete the onboarding wizard to customize your documentation with:
- Your logo and branding
- API reference documentation
- Custom pages and navigation
`
        );

        // All files in one initial commit - README, fern config, workflow, and generic docs
        const initialFiles = [
            {
                path: "README.md",
                content: `# ${orgName}\n\nDocumentation repository for ${orgName}.\n`
            },
            {
                path: "fern/fern.config.json",
                content: JSON.stringify({ organization: orgName, version: "*" }, null, 2)
            },
            {
                path: ".github/workflows/publish-docs.yml",
                content: `name: Publish Docs

on:
  push:
    branches:
      - main
    paths:
      - 'fern/**'
  workflow_dispatch:

jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Install Fern
        run: npm install -g fern-api

      - name: Publish Docs
        env:
          FERN_TOKEN: \${{ secrets.FERN_TOKEN }}
        run: fern generate --docs
`
            },
            {
                path: "fern/docs.yml",
                content: `instances:
  - url: ${docsUrl}

title: ${orgName} | Documentation

colors:
  accent-primary:
    dark: "#70E155"
    light: "#008700"

navigation:
  - section: Documentation
    contents:
      - page: Welcome
        path: docs/pages/welcome.mdx
`
            },
            {
                path: "fern/docs/pages/welcome.mdx",
                content: `---
title: Welcome
---

# Welcome to ${orgName}

Your documentation site is being set up. Once complete, this page will be replaced with your customized content.

## What's Next?

Complete the onboarding wizard to customize your documentation with:
- Your logo and branding
- API reference documentation
- Custom pages and navigation
`
            }
        ];

        console.log(`[preCreateRepo] Prepared ${initialFiles.length} files for initial commit`);

        // Find an available repo name (retry with random suffix if name is taken)
        let repoName = baseRepoName;
        const maxAttempts = 5;

        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            if (attempt > 0) {
                // Append random 6-digit suffix for retries
                repoName = `${baseRepoName}-${generateRandomSuffix()}`;
            }

            console.log(
                `[preCreateRepo] Checking if repo ${DEMO_BOT_OWNER}/${repoName} exists (attempt ${attempt + 1}/${maxAttempts})...`
            );

            const exists = await repoExists(DEMO_BOT_OWNER, repoName);
            if (!exists) {
                console.log(`[preCreateRepo] Repo name ${repoName} is available`);
                break;
            }

            console.log(`[preCreateRepo] Repo ${repoName} already exists, trying another name...`);

            if (attempt === maxAttempts - 1) {
                throw new Error(`Could not find available repo name after ${maxAttempts} attempts`);
            }
        }

        console.log(`[preCreateRepo] Creating repo ${DEMO_BOT_OWNER}/${repoName} for org ${orgName}`);

        // Get GitLoader with demo bot credentials
        const repoUrl = `https://github.com/${DEMO_BOT_OWNER}/${repoName}`;
        const loader = await getGitLoader(repoUrl, true);

        // Step 1: Create repository with ALL files in one commit
        const result = await loader.createRepository?.({
            owner: DEMO_BOT_OWNER,
            repoName,
            description: `Documentation for ${orgName}`,
            isPrivate: true,
            files: initialFiles
        });

        if (!result || result.type !== "ok") {
            const errorMsg = result?.type === "error" ? result.error.message : "createRepository not available";
            throw new Error(`Failed to create repository: ${errorMsg}`);
        }

        console.log(`[preCreateRepo] Repository created with all files: ${result.htmlUrl}`);

        // Step 2: Set FERN_TOKEN as GitHub secret
        // Retry with backoff since the org may not be propagated in Fern's backend yet
        let fernTokenSet = false;
        const maxRetries = 3;
        const baseDelayMs = 3000;

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            const delayMs = baseDelayMs * attempt; // 3s, 6s, 9s
            console.log(
                `[preCreateRepo] Attempt ${attempt}/${maxRetries}: waiting ${delayMs}ms before generating FERN_TOKEN...`
            );
            await new Promise((resolve) => setTimeout(resolve, delayMs));

            try {
                const tokenResult = await setFernTokenSecret({
                    owner: DEMO_BOT_OWNER,
                    repoName,
                    workingDir: tempDir,
                    fernToken: accessToken
                });

                if (tokenResult.success) {
                    fernTokenSet = true;
                    console.log(`[preCreateRepo] FERN_TOKEN set successfully for ${repoName}`);
                    break;
                } else {
                    console.warn(`[preCreateRepo] Attempt ${attempt} failed: ${tokenResult.error?.message}`);
                }
            } catch (tokenError) {
                console.error(`[preCreateRepo] Attempt ${attempt} error:`, tokenError);
            }
        }

        if (!fernTokenSet) {
            console.warn(`[preCreateRepo] Failed to set FERN_TOKEN after ${maxRetries} attempts`);
        }

        // Step 3: Trigger the workflow immediately (token is already set)
        if (fernTokenSet) {
            const triggerResult = await triggerWorkflow({
                owner: DEMO_BOT_OWNER,
                repoName,
                workflowId: "publish-docs.yml"
            });

            if (triggerResult.success) {
                console.log(`[preCreateRepo] Workflow triggered successfully for ${repoName}`);
            } else {
                console.warn(`[preCreateRepo] Failed to trigger workflow: ${triggerResult.error}`);
                // Non-critical - the workflow will run when user pushes customized content
            }
        }

        // Mark as completed in Redis
        await redisSet(
            RedisCacheKey.onboardingPreCreate(orgName),
            {
                status: "completed",
                repoUrl: result.htmlUrl,
                repoName,
                fernTokenSet,
                startedAt: existingStatus?.startedAt ?? Date.now(),
                completedAt: Date.now()
            },
            { ttlInSeconds: PRE_CREATE_TTL_SECONDS }
        );

        return {
            success: true,
            repoUrl: result.htmlUrl,
            repoName,
            fernTokenSet
        };
    } catch (error) {
        console.error("[preCreateRepo] Error:", error);

        // Mark as failed in Redis
        await redisSet(
            RedisCacheKey.onboardingPreCreate(orgName),
            {
                status: "failed",
                error: error instanceof Error ? error.message : "Unknown error",
                startedAt: existingStatus?.startedAt ?? Date.now(),
                completedAt: Date.now()
            },
            { ttlInSeconds: PRE_CREATE_TTL_SECONDS }
        );

        return {
            success: false,
            error: error instanceof Error ? error.message : "Unknown error"
        };
    } finally {
        // Cleanup temp directory
        if (tempDir) {
            try {
                await fs.rm(tempDir, { recursive: true, force: true });
            } catch (cleanupError) {
                console.error("[preCreateRepo] Failed to cleanup temp directory:", cleanupError);
            }
        }
    }
}

/**
 * Gets the current status of pre-creation for an organization.
 */
export async function getPreCreateStatus(orgName: string) {
    return redisGet(RedisCacheKey.onboardingPreCreate(orgName));
}
