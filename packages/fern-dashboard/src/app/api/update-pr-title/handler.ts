import type { GitOperationError } from "@fern-api/docs-loader";
import { getGitLoader } from "@/app/services/github/getGitLoader";

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
    gitUrl?: string;
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
    const gitUrl = request.gitUrl || `https://github.com/${request.owner}/${request.repo}`;
    console.log("[updatePrTitle] Using gitUrl:", gitUrl);
    const loader = getGitLoader(gitUrl);

    try {
        // First, find the PR/MR for the branch using the centralized method
        console.log("[updatePrTitle] Getting PR for branch:", {
            owner: request.owner,
            repo: request.repo,
            branch: request.branch
        });
        const getPrResult = await loader.getPullRequestForBranch?.({
            owner: request.owner,
            repo: request.repo,
            branch: request.branch,
            baseBranch: request.baseBranch
        });

        console.log("[updatePrTitle] getPullRequestForBranch result:", getPrResult);

        if (!getPrResult) {
            return {
                success: false,
                error: { type: "UNKNOWN_ERROR", message: "getPullRequestForBranch method not available on loader" }
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
                error: { type: "UNKNOWN_ERROR", message: "updatePullRequest method not available on loader" }
            };
        }

        if (updateResult.type === "ok") {
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
