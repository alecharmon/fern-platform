import "server-only";

import { FernConfigJsonErrors } from "@fern-api/docs-loader";

import { getFernBotOctokitForRepo } from "@/app/services/auth0/fernBotOctokit";
import { getOwnerAndRepoFromGithubUrl } from "@/app/services/github/github";

import { GitHubLoader } from "../../github/github-loader";

export type CheckOrgWritePermissionToRepoError =
    | { type: "MALFORMED_GITHUB_URL"; url: string }
    | { type: "FERN_BOT_NOT_INSTALLED" }
    | { type: "FERN_CONFIG_JSON_ORG_MISMATCH" }
    | FernConfigJsonErrors;

export type CheckOrgWritePermissionToRepoResult =
    | { ok: true }
    | { ok: false; error: CheckOrgWritePermissionToRepoError };

/**
 * Checks if the user has write permission to a given GitHub repository.
 *
 * @param userId - The ID of the user to check
 * @param githubUrl - The URL of the GitHub repository to check
 * @returns true if the user has write permission, false otherwise
 */
export async function checkOrgWritePermissionToRepo(
    orgName: string,
    site: string,
    githubUrl: string
): Promise<CheckOrgWritePermissionToRepoResult> {
    const { owner, repo } = getOwnerAndRepoFromGithubUrl(githubUrl);
    if (owner == null || repo == null) {
        return {
            ok: false,
            error: { type: "MALFORMED_GITHUB_URL", url: githubUrl }
        };
    }

    // Use Fern bot to check permissions
    const fernBotResult = await getFernBotOctokitForRepo(owner, repo);
    if (!fernBotResult.ok) {
        if (fernBotResult.error.type === "NOT_INSTALLED") {
            return {
                ok: false,
                error: { type: "FERN_BOT_NOT_INSTALLED" }
            };
        }

        // For other errors, let's treat it as an internal server error for now
        throw new Error(
            `Internal server error while checking Fern bot installation or permissions: ${JSON.stringify(
                fernBotResult.error
            )}`
        );
    }

    const githubLoader = new GitHubLoader(githubUrl);

    // Use the helper function to fetch fern.config.json from the repo
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
