"use server";

import type { DocsUrl } from "@/utils/types";
import { getCurrentSession } from "../services/auth0/getCurrentSession";
import { getFernVersionFromRepo } from "../services/dal/github/getFernVersionFromRepo";
import { getOwnerAndRepoFromGithubUrl } from "../services/github/github";
import { invalidateCommitRefCache } from "../services/github/github-loader";

/**
 * Server action to check if the Fern CLI version has been upgraded in the repository.
 *
 * This action:
 * 1. Invalidates the commit ref cache to force a fresh fetch from GitHub
 * 2. Fetches the current version from the repo
 * 3. Compares it with the expected target version
 *
 * Use this to poll after creating an upgrade PR to detect when the PR has been merged.
 */
export async function checkVersionUpgradeAction(
    githubUrl: string,
    docsUrl: DocsUrl,
    baseBranch: string,
    targetVersion: string
): Promise<{ upgraded: boolean; currentVersion?: string; error?: string }> {
    const session = await getCurrentSession();
    if (session == null) {
        return { upgraded: false, error: "Not authenticated" };
    }
    try {
        const { owner, repo } = getOwnerAndRepoFromGithubUrl(githubUrl);

        if (!owner || !repo) {
            return {
                upgraded: false,
                error: "Invalid GitHub URL"
            };
        }

        // Invalidate cache to mark it as stale (will be refetched after 1-minute revalidation window)
        invalidateCommitRefCache(owner, repo, baseBranch);

        // Fetch the current version
        const versionResult = await getFernVersionFromRepo(githubUrl, docsUrl);

        if (!versionResult.ok) {
            return {
                upgraded: false,
                error: versionResult.error.type
            };
        }

        const upgraded = versionResult.version === targetVersion;

        return {
            upgraded,
            currentVersion: versionResult.version
        };
    } catch (error) {
        console.error("Failed to check version upgrade", error);
        return {
            upgraded: false,
            error: error instanceof Error ? error.message : "Unknown error"
        };
    }
}
