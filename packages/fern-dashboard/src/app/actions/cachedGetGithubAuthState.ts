import "server-only";

import { validateGitRepoAccess } from "@/app/services/dal/git/validateGitRepoAccess";
import type { GitAuthState } from "@/components/docs-page/GitSourceClient";
import type { DocsUrl } from "@/utils/types";

import type { Auth0OrgName } from "../services/auth0/types";
import { getCachedDocsGitUrl } from "../services/dal/github/cachedGetDocsGitUrl";
import { parseGitUrl } from "../services/git-common/url-utils";
import type { GetGitHubAuthStateResult } from "./getGithubMetadata";
import { getGithubSourceMetadata } from "./getGithubSourceMetadata";
import { getGitlabSourceMetadata } from "./getGitlabSourceMetadata";

/**
 * Cached version of getGitHubAuthState.
 * Orchestrates individually-cached sub-calls to avoid re-running expensive
 * GitHub validation and metadata fetches on every visit to the docs overview page.
 *
 * Each sub-call has its own persistent cache:
 * - getCachedDocsGitUrl: "use cache" with 1-hour TTL
 * - getGithubSourceMetadata: unstable_cache with 5-min TTL
 * - getGitlabSourceMetadata: unstable_cache with 5-min TTL
 *
 * No token or session is needed — git URL uses fernToken_admin(), validation
 * uses bot tokens, and metadata uses bot tokens or gitlab tokens.
 */
export async function getCachedGitHubAuthState(
    docsUrl: DocsUrl,
    orgName: Auth0OrgName,
    userId: string
): Promise<GetGitHubAuthStateResult> {
    const urlResult = await getCachedDocsGitUrl(docsUrl);

    if (!urlResult.success) {
        return { success: false, error: urlResult.error };
    }

    const gitUrl = urlResult.gitUrl;
    let githubAuthState: GitAuthState = {
        validationResult: {
            ok: false,
            provider: "unknown",
            error: {
                type: "UNEXPECTED_ERROR",
                message: ""
            }
        },
        sourceRepo: undefined,
        isLoading: false
    };

    try {
        // Determine provider to fetch appropriate metadata
        const parsed = parseGitUrl(gitUrl);
        const isGitLab = parsed.provider === "gitlab";

        // Parallelize cached validation and cached metadata fetching
        const [validation, sourceRepo] = await Promise.all([
            validateGitRepoAccess(orgName, docsUrl, gitUrl),
            // Metadata functions have their own internal unstable_cache (5-min TTL)
            isGitLab
                ? getGitlabSourceMetadata({
                      gitlabUrl: gitUrl,
                      userId
                  }).catch((error) => {
                      console.error("Failed to fetch GitLab source repo metadata:", error);
                      return undefined;
                  })
                : getGithubSourceMetadata({
                      githubUrl: gitUrl,
                      userId
                  }).catch((error) => {
                      console.error("Failed to fetch GitHub source repo metadata:", error);
                      return undefined;
                  })
        ]);

        githubAuthState = {
            validationResult: validation,
            // Only include sourceRepo if validation succeeded
            sourceRepo: validation.ok ? sourceRepo : undefined,
            isLoading: false
        };
    } catch (error) {
        console.error("Failed to validate GitHub access:", error);
        // Keep default false state
    }

    return { success: true, ...githubAuthState };
}
