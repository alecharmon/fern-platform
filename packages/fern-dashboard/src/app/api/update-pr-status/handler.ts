import { getFernBotOctokitForRepo } from "@/app/services/auth0/fernBotOctokit";
import { GithubPrStatus } from "@/app/services/github/types";

import getPrForBranch from "../get-pr-for-branch/handler";

const convertToDraftMutation = `mutation ConvertPullRequestToDraft($pullRequestId: ID!) {
  convertPullRequestToDraft(input: { pullRequestId: $pullRequestId }) {
    pullRequest {
      id
      isDraft
    }
  }
}`;

const markPrReadyForReviewMutation = `mutation MarkPullRequestReadyForReview($pullRequestId: ID!) {
  markPullRequestReadyForReview(input: { pullRequestId: $pullRequestId }) {
    clientMutationId
  }
}`;

/**
 * Updates the status of a PR (open or draft).
 */
export default async function updatePrStatus(request: {
  owner: string;
  repo: string;
  branch: string;
  status: "open" | "draft";
  baseBranch?: string;
}): Promise<
  | { success: false; error: string }
  | {
      success: true;
      status?: GithubPrStatus;
      prNumber?: number;
      prUrl?: string;
    }
> {
  const { owner, repo } = request;

  const octokit = await getFernBotOctokitForRepo(owner, repo);

  if (octokit == null) {
    return { success: false, error: "Failed to get GitHub client" };
  }

  try {
    const pr = await getPrForBranch({
      owner,
      repo,
      branch: request.branch,
      baseBranch: request.baseBranch,
    });

    if (pr?.nodeId == null) {
      return { success: false, error: "No PR found for this branch" };
    }

    // DEV NOTE: The github API does not support a way to convert PRs from draft
    // to ready and vice versa. So instead we have to use graphql mutations directly.
    if (request.status === "open") {
      await octokit.graphql(markPrReadyForReviewMutation, {
        pullRequestId: pr.nodeId,
      });

      return {
        success: true,
        status: "open",
      };
    }
    if (request.status === "draft") {
      await octokit.graphql(convertToDraftMutation, {
        pullRequestId: pr.nodeId,
      });

      return {
        success: true,
        status: "draft",
      };
    }
    return {
      success: false,
      error: "Unable to convert PR to requested status: " + request.status,
    };
  } catch (error) {
    console.error("Failed to update PR status", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error occurred",
    };
  }
}
