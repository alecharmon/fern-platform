import { getCurrentSession } from "@/app/services/auth0/getCurrentSession";
import { getOctokit } from "@/app/services/auth0/octokit";
import { Auth0OrgName, Auth0UserID } from "@/app/services/auth0/types";

export default async function getPrForBranch(
  userId: Auth0UserID,
  orgName: Auth0OrgName,
  request: {
    owner: string;
    repo: string;
    branch: string;
    baseBranch?: string;
  }
): Promise<{
  success: boolean;
  error?: string;
  title?: string;
  prNumber?: number;
  prUrl?: string;
}> {
  const session = await getCurrentSession();
  if (session == null) {
    return { success: false, error: "No session found" };
  }

  const octokit = await getOctokit(userId, orgName);

  if (octokit == null) {
    return { success: false, error: "Failed to get GitHub client" };
  }

  try {
    // Find PR for the branch
    const response = await octokit.request("GET /repos/{owner}/{repo}/pulls", {
      owner: request.owner,
      repo: request.repo,
      head: `${request.owner}:${request.branch}`,
      state: "open",
      base: request.baseBranch,
    });

    if (response.data.length === 0) {
      return { success: false, error: "No open PR found for this branch" };
    }
    if (response.data.length > 1) {
      return {
        success: false,
        error: "Multiple open PRs found for this branch",
      };
    }

    const pr = response.data[0];
    return {
      success: true,
      title: pr?.title,
      prNumber: pr?.number,
      prUrl: pr?.html_url,
    };
  } catch (error) {
    console.error("Failed to fetch PR for branch", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error occurred",
    };
  }
}
