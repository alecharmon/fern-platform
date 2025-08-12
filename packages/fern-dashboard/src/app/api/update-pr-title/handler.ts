import { getCurrentSession } from "@/app/services/auth0/getCurrentSession";
import { getOctokit } from "@/app/services/auth0/octokit";
import { Auth0OrgName, Auth0UserID } from "@/app/services/auth0/types";

export default async function updatePrTitle(
  userId: Auth0UserID,
  orgName: Auth0OrgName,
  request: {
    owner: string;
    repo: string;
    branch: string;
    title: string;
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
    // First, find the PR for the branch
    const getPrsResponse = await octokit.request(
      "GET /repos/{owner}/{repo}/pulls",
      {
        owner: request.owner,
        repo: request.repo,
        head: `${request.owner}:${request.branch}`,
        state: "open",
        base: request.baseBranch,
      }
    );

    const pr = getPrsResponse?.data?.[0];
    if (pr == null) {
      return { success: false, error: "No PR found for this branch" };
    }

    // Update the PR title
    const updateResponse = await octokit.request(
      "PATCH /repos/{owner}/{repo}/pulls/{pull_number}",
      {
        owner: request.owner,
        repo: request.repo,
        pull_number: pr.number,
        title: request.title,
      }
    );

    return {
      success: true,
      title: updateResponse.data.title,
      prNumber: updateResponse.data.number,
      prUrl: updateResponse.data.html_url,
    };
  } catch (error) {
    console.error("Failed to update PR title", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error occurred",
    };
  }
}
