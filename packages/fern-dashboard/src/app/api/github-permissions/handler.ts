import { getOctokit } from "@/app/services/auth0/octokit";
import { Auth0OrgName, Auth0UserID } from "@/app/services/auth0/types";

export interface GitHubPermissionsResponse {
  hasRepoAccess: boolean;
  error?: string;
}
const REQUIRED_SCOPES = ["repo", "read:user", "read:org"];

export default async function checkGitHubPermissions(
  userId: Auth0UserID,
  orgName?: Auth0OrgName
): Promise<GitHubPermissionsResponse> {
  const octokit = await getOctokit(userId, orgName);
  if (octokit == null) {
    return {
      hasRepoAccess: false,
      error: "Github access token not found",
    };
  }
  const response = await octokit.request("GET /user");
  const scopesHeader = response.headers["x-oauth-scopes"];
  if (!scopesHeader) {
    return {
      hasRepoAccess: false,
      error: "Missing scopes header",
    };
  }
  const actualScopes = scopesHeader.split(",").map((s) => s.trim());
  const missing = REQUIRED_SCOPES.filter(
    (scope) => !actualScopes.includes(scope)
  );
  if (missing.length > 0) {
    return {
      hasRepoAccess: false,
      error: "Missing required scopes",
    };
  }
  return {
    hasRepoAccess: true,
  };
}

export async function checkWritePermissionToRepo(
  userId: Auth0UserID,
  orgName: Auth0OrgName,
  owner: string,
  repo: string
) {
  const octokit = await getOctokit(userId, orgName);
  if (octokit == null) {
    return false;
  }
  try {
    const response = await octokit.request("GET /repos/{owner}/{repo}", {
      owner,
      repo,
    });
    const perms = response.data.permissions;
    return perms?.push;
  } catch (_error) {
    return false;
  }
}
