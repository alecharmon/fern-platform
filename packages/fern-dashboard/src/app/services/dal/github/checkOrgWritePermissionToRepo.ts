import "server-only";

import type { FernConfigJsonErrors } from "@fern-api/docs-loader";

import { getFernBotOctokitForRepo, getGheOctokitForRepo } from "@/app/services/auth0/fernBotOctokit";
import { parseGitUrl } from "@/app/services/git-common/url-utils";
import { isGheUrl } from "@/app/services/github/ghe-config";
import type { DocsUrl } from "@/utils/types";

import { getCachedGitHubLoader, getUncachedGitHubLoader } from "../../github/cachedGitHubLoader";

export type CheckOrgWritePermissionToRepoError =
    | { type: "MALFORMED_GIT_URL"; url: string }
    | { type: "FERN_BOT_NOT_INSTALLED" }
    | { type: "GHE_APP_NOT_INSTALLED" }
    | { type: "FERN_CONFIG_JSON_ORG_MISMATCH" }
    | FernConfigJsonErrors;

export type CheckOrgWritePermissionToRepoResult =
    | { ok: true }
    | { ok: false; error: CheckOrgWritePermissionToRepoError };

/**
 * Checks if the user has write permission to a given GitHub repository.
 * Supports both github.com and GitHub Enterprise URLs.
 *
 * @param orgName - The organization name
 * @param site - The docs URL/site
 * @param githubUrl - The URL of the GitHub repository to check
 * @param skipCache - If true, bypasses React cache and fetches fresh data from GitHub
 * @returns Validation result
 */
export async function checkOrgWritePermissionToRepo(
    orgName: string,
    site: DocsUrl,
    githubUrl: string,
    skipCache: boolean = false
): Promise<CheckOrgWritePermissionToRepoResult> {
    // Use parseGitUrl which handles both github.com and GHE URLs
    const { owner, repo } = parseGitUrl(githubUrl);

    if (owner == null || repo == null) {
        return {
            ok: false,
            error: { type: "MALFORMED_GIT_URL", url: githubUrl }
        };
    }

    // Check if this is a GitHub Enterprise URL
    const isGhe = await isGheUrl(githubUrl);

    // Use appropriate Octokit based on whether this is GHE or github.com
    const octokitResult = isGhe
        ? await getGheOctokitForRepo(githubUrl, owner, repo)
        : await getFernBotOctokitForRepo(owner, repo);

    if (!octokitResult.ok) {
        // github.com: Fern Bot app not installed
        if (octokitResult.error.type === "NOT_INSTALLED") {
            return {
                ok: false,
                error: { type: "FERN_BOT_NOT_INSTALLED" }
            };
        }

        // GHE: Customer's GitHub App not installed on this repo
        if (octokitResult.error.type === "NO_INSTALLATION") {
            return {
                ok: false,
                error: { type: "GHE_APP_NOT_INSTALLED" }
            };
        }

        // For other errors, treat it as an internal server error
        throw new Error(
            `Internal server error while checking bot installation or permissions: ${JSON.stringify(
                octokitResult.error
            )}`
        );
    }

    // Use uncached loader if skipCache is true to bypass React cache
    const githubLoader = skipCache ? await getUncachedGitHubLoader(githubUrl) : await getCachedGitHubLoader(githubUrl);

    // Fetch fern.config.json from the repo
    const fernConfigResult = await githubLoader.getFernConfigJson(owner, repo, site);

    if (fernConfigResult.type !== "ok") {
        return {
            ok: false,
            error: fernConfigResult.error
        };
    }

    const fernConfigJson = fernConfigResult.result;

    if (fernConfigJson.organization !== orgName) {
        return {
            ok: false,
            error: { type: "FERN_CONFIG_JSON_ORG_MISMATCH" }
        };
    }

    return { ok: true };
}
