"use server";

import { getFernBotOctokitForRepo } from "@/app/services/auth0/fernBotOctokit";
import { getCurrentSession } from "@/app/services/auth0/getCurrentSession";
import { Auth0OrgName } from "@/app/services/auth0/types";
import { validateGithubRepoAccess } from "@/app/services/dal/github/validators";
import { DocsUrl } from "@/utils/types";

import { assertUserHasOrganizationAccess } from "../organization";

export default async function createBranchIfNotExists(request: {
  owner: string;
  repo: string;
  branch: string;
  baseBranch: string;
  orgName: Auth0OrgName;
  site: DocsUrl;
}): Promise<{
  success: boolean;
  error?: string;
  baseSha?: string;
  response?: any;
}> {
  const session = await getCurrentSession();
  if (session == null) {
    return { success: false, error: "No session found" };
  }

  try {
    await assertUserHasOrganizationAccess({
      userId: session.user.sub,
      orgName: request.orgName,
    });
  } catch (_) {
    return {
      success: false,
      error: "User is not a member of the specified organization",
    };
  }

  const result = await validateGithubRepoAccess(request.orgName, request.site, {
    type: "owner-repo",
    owner: request.owner,
    repo: request.repo,
  });

  if (!result.ok) {
    return { success: false, error: result.error.type };
  }

  const octokitResult = await getFernBotOctokitForRepo(
    request.owner,
    request.repo
  );

  if (!octokitResult.ok) {
    throw new Error(`Failed to get GitHub client: ${octokitResult.error.type}`);
  }

  const octokit = octokitResult.octokit;

  try {
    // Check if the branch already exists
    try {
      const existingBranchResponse = await octokit.request(
        "GET /repos/{owner}/{repo}/git/ref/{ref}",
        {
          owner: request.owner,
          repo: request.repo,
          ref: `heads/${request.branch}`,
        }
      );

      // Branch exists, return success with existing branch data
      return {
        success: true,
        baseSha: existingBranchResponse.data.object.sha,
        response: existingBranchResponse,
      };
    } catch (branchCheckError: any) {
      // Branch doesn't exist (404), continue to create it
      if (branchCheckError.status !== 404) {
        throw branchCheckError;
      }
    }

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
