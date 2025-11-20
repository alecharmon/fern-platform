import type { GitOperationError } from "@fern-api/docs-loader";
import { getGitLoaderByOwnerRepo } from "@/app/services/github/getGitLoader";
import type { GitHubLoader } from "@/app/services/github/github-loader";

export type UpdatePrTitleErrors = GitOperationError | { type: "PR_NOT_FOUND"; message: string };

/**
 * Updates the title of a PR.
 */
export default async function updatePrTitle(request: {
    owner: string;
    repo: string;
    branch: string;
    title: string;
    baseBranch?: string;
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
    const { owner, repo } = request;

    // Get GitLoader instance
    const loader = getGitLoaderByOwnerRepo(owner, repo) as GitHubLoader;

    // Need to find the PR first - this requires direct Octokit access
    const octokit = await loader.getOctokit();
    if (!octokit) {
        return {
            success: false,
            error: { type: "OPERATION_FAILED", message: "Failed to get GitHub client" }
        };
    }

    try {
        // First, find the PR for the branch
        const getPrsResponse = await octokit.request("GET /repos/{owner}/{repo}/pulls", {
            owner: request.owner,
            repo: request.repo,
            head: `${request.owner}:${request.branch}`,
            state: "open",
            base: request.baseBranch
        });

        const pr = getPrsResponse?.data?.[0];
        if (pr == null) {
            return {
                success: false,
                error: { type: "PR_NOT_FOUND", message: "No PR found for this branch" }
            };
        }

        // Update the PR using GitLoader
        const result = await loader.updatePullRequest?.({
            owner: request.owner,
            repo: request.repo,
            prNumber: pr.number,
            title: request.title
        });

        if (!result) {
            return {
                success: false,
                error: { type: "UNKNOWN_ERROR", message: "updatePullRequest method not available on loader" }
            };
        }

        if (result.type === "ok") {
            return {
                success: true,
                title: request.title,
                prNumber: pr.number,
                prUrl: pr.html_url
            };
        } else {
            return { success: false, error: result.error };
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
