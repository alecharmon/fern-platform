import { getCurrentSession } from "@/app/services/auth0/getCurrentSession";
import { getOctokit } from "@/app/services/auth0/octokit";
import { Auth0OrgName, Auth0UserID } from "@/app/services/auth0/types";

export default async function postCreateBranch(
  userId: Auth0UserID,
  orgName: Auth0OrgName,
  request: {
    owner: string;
    repo: string;
    branch: string;
    baseBranch: string;
  }
): Promise<{
  success: boolean;
  error?: string;
  baseSha?: string;
  response?: any;
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
    // Get the latest commit SHA on base branch
    const {
      data: {
        object: { sha: baseSha },
      },
    } = await octokit.request("GET /repos/{owner}/{repo}/git/ref/{ref}", {
      owner: request.owner,
      repo: request.repo,
      ref: `heads/${request.baseBranch}`,
    });

    // Create the new branch
    const response = await octokit.request(
      "POST /repos/{owner}/{repo}/git/refs",
      {
        owner: request.owner,
        repo: request.repo,
        ref: `refs/heads/${request.branch}`,
        sha: baseSha,
      }
    );

    return {
      success: true,
      baseSha,
      response,
    };
  } catch (error) {
    return {
      success: false,
      error: `Unknown error occurred: ${error}`, // TODO: Add error message
    };
  }
}
