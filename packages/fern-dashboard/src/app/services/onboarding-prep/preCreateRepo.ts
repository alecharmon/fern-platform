"use server";

import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";

import { RedisCacheKey } from "@/app/services/redis/cacheKey";
import { redisGet, redisSet } from "@/app/services/redis/redis";
import { fernCliConfig } from "@/utils/fernCliConfig";
import { getDemoCreationBotOctokit } from "../auth0/fernBotOctokit";
import { setFernTokenSecret } from "../dal/github/setFernTokenSecret";
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
 * Pre-creates a GitHub repository (empty, with only auto_init) for faster onboarding.
 *
 * Flow:
 * 1. Create repo with only auto_init commit (no template files)
 * 2. Set FERN_TOKEN as GitHub secret
 *
 * All content (template files + customizations + API specs) is added in a single
 * commit by the customize endpoint, avoiding race conditions from concurrent
 * publish-docs workflow triggers.
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
        const docsUrl = `${baseRepoName}.${fernCliConfig.docsDomain}`;

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

        console.log(`[preCreateRepo] Will create repo with auto_init only (no template files)`);

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

        // Step 1: Create repository with only auto_init commit (no template files).
        // All content will be added in a single commit by the customize endpoint.
        const result = await loader.createRepository?.({
            owner: DEMO_BOT_OWNER,
            repoName,
            description: `Documentation for ${orgName}`,
            isPrivate: true,
            files: []
        });

        if (!result || result.type !== "ok") {
            const errorMsg = result?.type === "error" ? result.error.message : "createRepository not available";
            throw new Error(`Failed to create repository: ${errorMsg}`);
        }

        console.log(`[preCreateRepo] Repository created: ${result.htmlUrl}`);

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

        // No workflow trigger needed - the customize endpoint will push all content
        // in a single commit which will trigger the publish-docs workflow

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
