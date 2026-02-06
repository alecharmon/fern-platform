import type { GitOperationError } from "@fern-api/docs-loader";

import { getGitLoader } from "@/app/services/github/getGitLoader";
import { RedisCacheKey } from "@/app/services/redis/cacheKey";
import { redisDel } from "@/app/services/redis/redis";

export type UpdatePrTitleErrors = GitOperationError | { type: "PR_NOT_FOUND"; message: string };

/**
 * Updates the title of a PR/MR using the GitLoader abstraction.
 * Works with both GitHub and GitLab repositories.
 */
export default async function updatePrTitle(request: {
    owner: string;
    repo: string;
    branch: string;
    title: string;
    baseBranch?: string;
    repoUrl?: string;
}): Promise<
    | {
          success: true;
          title: string;
          prNumber: number;
          prUrl: string;
      }
    | {
          success: false;
          error: UpdatePrTitleErrors;
      }
> {
    // Get GitLoader instance
    const repoUrl = request.repoUrl || `https://github.com/${request.owner}/${request.repo}`;
    const loader = await getGitLoader(repoUrl);

    try {
        // First, find the PR/MR for the branch using the centralized method
        const getPrResult = await loader.getPullRequestForBranch?.({
            owner: request.owner,
            repo: request.repo,
            branch: request.branch,
            baseBranch: request.baseBranch
        });

        if (!getPrResult) {
            return {
                success: false,
                error: {
                    type: "UNKNOWN_ERROR",
                    message: "getPullRequestForBranch method not available on loader"
                }
            };
        }

        if (getPrResult.type === "error") {
            return {
                success: false,
                error: { type: "PR_NOT_FOUND", message: getPrResult.error }
            };
        }

        // Update the PR/MR using GitLoader
        const updateResult = await loader.updatePullRequest?.({
            owner: request.owner,
            repo: request.repo,
            prNumber: getPrResult.prNumber,
            title: request.title
        });

        if (!updateResult) {
            return {
                success: false,
                error: {
                    type: "UNKNOWN_ERROR",
                    message: "updatePullRequest method not available on loader"
                }
            };
        }

        if (updateResult.type === "ok") {
            const cacheKey = RedisCacheKey.githubPrForBranch(
                request.owner,
                request.repo,
                request.branch,
                request.baseBranch
            );
            try {
                await redisDel(cacheKey);
            } catch (error) {
                console.warn("Failed to invalidate PR cache after title update", error);
            }

            return {
                success: true,
                title: request.title,
                prNumber: getPrResult.prNumber,
                prUrl: getPrResult.prUrl
            };
        } else {
            return { success: false, error: updateResult.error };
        }
    } catch (error) {
        console.error("Failed to update PR title", error);
        return {
            success: false,
            error: {
                type: "UNKNOWN_ERROR",
                message: error instanceof Error ? error.message : "Unknown error occurred"
            }
        };
    }
}
