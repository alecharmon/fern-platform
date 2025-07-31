import { getCurrentSession } from "@/app/services/auth0/getCurrentSession";
import { getOctokit } from "@/app/services/auth0/octokit";
import { Auth0OrgName, Auth0UserID } from "@/app/services/auth0/types";

export default async function postCreatePr(
  userId: Auth0UserID,
  orgName: Auth0OrgName,
  request: {
    owner: string;
    repo: string;
    head: string;
    base: string;
    title: string;
    body?: string;
    draft?: boolean;
  }
): Promise<{
  success: boolean;
  error?: string;
  prUrl?: string;
  prNumber?: number;
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
    // Create the pull request
    const response = await octokit.request("POST /repos/{owner}/{repo}/pulls", {
      owner: request.owner,
      repo: request.repo,
      head: request.head,
      base: request.base,
      title: request.title,
      body: request.body,
      draft: request.draft || false,
    });

    return {
      success: true,
      prUrl: response.data.html_url,
      prNumber: response.data.number,
      response,
    };
  } catch (error) {
    console.error("Failed to create pull request", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error occurred",
    };
  }
}
