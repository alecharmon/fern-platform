import "server-only";

import type { FernConfigJsonErrors } from "@fern-api/docs-loader";

import { getFernBotOctokitForRepo, getGheOctokitForRepo } from "@/app/services/auth0/fernBotOctokit";
import { parseGitUrl } from "@/app/services/git-common/url-utils";
import { isGheUrl } from "@/app/services/github/ghe-config";
import type { DocsUrl } from "@/utils/types";

import { GitHubLoader } from "../../github/github-loader";

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
 * @returns Validation result
 */
export async function checkOrgWritePermissionToRepo(
    orgName: string,
    site: DocsUrl,
    githubUrl: string
): Promise<CheckOrgWritePermissionToRepoResult> {
    console.log(`[checkOrgWritePermissionToRepo] Starting: orgName=${orgName}, site=${site}, githubUrl=${githubUrl}`);

    // Use parseGitUrl which handles both github.com and GHE URLs
    const { owner, repo } = parseGitUrl(githubUrl);
    console.log(`[checkOrgWritePermissionToRepo] Parsed: owner=${owner}, repo=${repo}`);

    if (owner == null || repo == null) {
        console.error(`[checkOrgWritePermissionToRepo] Failed: MALFORMED_GIT_URL`);
        return {
            ok: false,
            error: { type: "MALFORMED_GIT_URL", url: githubUrl }
        };
    }

    // Check if this is a GitHub Enterprise URL
    const isGhe = await isGheUrl(githubUrl);
    console.log(`[checkOrgWritePermissionToRepo] isGhe=${isGhe}`);

    // Use appropriate Octokit based on whether this is GHE or github.com
    const octokitResult = isGhe
        ? await getGheOctokitForRepo(
              githubUrl,
              owner,
              repo,
              "checkOrgWritePermissionToRepo.ts:checkOrgWritePermissionToRepo"
          )
        : await getFernBotOctokitForRepo(owner, repo, "checkOrgWritePermissionToRepo.ts:checkOrgWritePermissionToRepo");

    if (!octokitResult.ok) {
        console.error(`[checkOrgWritePermissionToRepo] Octokit failed:`, JSON.stringify(octokitResult.error, null, 2));

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

    console.log(`[checkOrgWritePermissionToRepo] Octokit obtained successfully`);

    const authMode = isGhe ? ("ghe" as const) : ("fern-bot" as const);
    const loader = new GitHubLoader({ githubUrl }, authMode);

    // Fetch fern.config.json from the repo
    console.log(`[checkOrgWritePermissionToRepo] Fetching fern.config.json from ${owner}/${repo}`);
    const fernConfigResult = await loader.getFernConfigJson(owner, repo, site);

    if (fernConfigResult.type !== "ok") {
        console.error(
            `[checkOrgWritePermissionToRepo] fern.config.json error:`,
            JSON.stringify(fernConfigResult.error, null, 2)
        );
        return {
            ok: false,
            error: fernConfigResult.error
        };
    }

    const fernConfigJson = fernConfigResult.result;
    console.log(
        `[checkOrgWritePermissionToRepo] fern.config.json org=${fernConfigJson.organization}, expected=${orgName}`
    );

    if (fernConfigJson.organization !== orgName) {
        console.error(`[checkOrgWritePermissionToRepo] Failed: FERN_CONFIG_JSON_ORG_MISMATCH`);
        return {
            ok: false,
            error: { type: "FERN_CONFIG_JSON_ORG_MISMATCH" }
        };
    }

    console.log(`[checkOrgWritePermissionToRepo] Success!`);
    return { ok: true };
}
