import { getOctokit } from "@/app/services/auth0/octokit";
import { Auth0OrgName, Auth0UserID } from "@/app/services/auth0/types";

export type ValidateGithubBranchResponse = {
  exists: boolean;
  error?: string;
};

export default async function validateGithubBranchHandler({
  owner,
  repo,
  branchName,
  userId,
  orgName,
}: {
  owner: string;
  repo: string;
  branchName: string;
  userId: Auth0UserID;
  orgName: Auth0OrgName;
}): Promise<ValidateGithubBranchResponse> {
  const octokit = await getOctokit(userId, orgName);
  if (octokit == null) {
    return {
      exists: false,
      error: "Failed to get Octokit instance",
    };
  }

  if (!owner || !repo) {
    return {
      exists: false,
      error: "Owner and repo are required",
    };
  }

  try {
    // Use Octokit to check if the branch exists
    await octokit.request("GET /repos/{owner}/{repo}/branches/{branch}", {
      owner,
      repo,
      branch: branchName,
    });

    // If we get here, the branch exists
    return {
      exists: true,
    };
  } catch (error: any) {
    // If the branch doesn't exist, GitHub returns a 404
    if (error.status === 404) {
      return {
        exists: false,
      };
    }

    // For other errors (like permission issues, network problems, etc.)
    console.error("Failed to check branch existence", error);
    return {
      exists: false,
      error: "Failed to check branch existence",
    };
  }
}
