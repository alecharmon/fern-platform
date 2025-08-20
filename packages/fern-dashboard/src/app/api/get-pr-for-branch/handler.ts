import { getFernBotOctokitForRepo } from "@/app/services/auth0/fernBotOctokit";
import { getCurrentSession } from "@/app/services/auth0/getCurrentSession";

export default async function getPrForBranch(request: {
  owner: string;
  repo: string;
  branch: string;
  baseBranch?: string;
}): Promise<{
  success: boolean;
  error?: string;
  title?: string;
  prNumber?: number;
  prUrl?: string;
  status?: string;
  draft?: boolean;
  merged?: boolean;
  nodeId?: string;
}> {
  const session = await getCurrentSession();
  if (session == null) {
    return { success: false, error: "No session found" };
  }

  const octokit = await getFernBotOctokitForRepo(request.owner, request.repo);

  if (octokit == null) {
    return { success: false, error: "Failed to get GitHub client" };
  }

  try {
    // Find associated PRs for the branch
    const response = await octokit.request("GET /repos/{owner}/{repo}/pulls", {
      owner: request.owner,
      repo: request.repo,
      head: `${request.owner}:${request.branch}`,
      base: request.baseBranch,
      state: "all", // we fetch all so that we are able to display the status if its not open
    });

    if (response.data.length === 0) {
      return {
        success: false,
        error: "No associated PRs found for this branch",
      };
    }

    const openPrs = response.data.filter((pr) => pr.state === "open");

    if (openPrs.length > 1) {
      return {
        success: false,
        error: "Multiple open PRs found for this branch",
      };
    }

    // Use the open PR if it exists, otherwise use the first PR returned.
    // The UI will handle the case where the PR is closed/merged, but we should error (above)
    // if there are multiple open PRs.
    const pr = openPrs[0] || response.data[0];
    return {
      success: true,
      title: pr?.title,
      prNumber: pr?.number,
      prUrl: pr?.html_url,
      status: pr?.state,
      draft: pr?.draft,
      merged: pr?.merged_at != null,
      nodeId: pr?.node_id,
    };
  } catch (error) {
    console.error("Failed to fetch PR for branch", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error occurred",
    };
  }
}
