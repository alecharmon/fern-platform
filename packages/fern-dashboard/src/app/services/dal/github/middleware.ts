import "server-only";

import { NextRequest, NextResponse } from "next/server";

import { maybeGetCurrentSession } from "@/app/api/utils/maybeGetCurrentSession";
import { Auth0OrgName } from "@/app/services/auth0/types";
import { getValidationErrorMessage } from "@/utils/errors";

import { getOwnerAndRepoFromGithubUrl } from "../../github/github";
import { assertUserHasOrganizationAccess } from "../organization";
import type { GithubIdentificationSchemeType, RepoIdentifier } from "./types";
import { validateGithubRepoAccess } from "./validators";

export interface ParsedRepoData {
  owner: string;
  repo: string;
  site: string;
  githubUrl: string;
}

/**
 * Validates user authentication, organization membership, and GitHub repository access,
 * then executes authenticated code
 *
 * This function:
 * 1. Validates user session authentication
 * 2. Confirms user is a member of the specified Auth0 organization
 * 3. Parses repository information from GithubIdentificationScheme
 * 4. Validates GitHub access permissions for the specified organization and repository
 * 5. Executes the provided callback with parsed repo data if all validations pass
 * 6. Returns appropriate HTTP status codes if any validation fails
 *
 * @param req - The NextRequest object for session validation
 * @param orgName - The organization name
 * @param repoData - Repository data matching GithubIdentificationScheme (either githubUrl or owner/repo)
 * @param callback - The authenticated code to execute after validation passes
 * @returns NextResponse with either the callback result or an error
 *
 * @example
 * const { orgName, ...repoData } = validatedBody;
 * return withGithubAuth(req, orgName, repoData, async ({ owner, repo, githubUrl }) => {
 *   const result = await someGitOperation({ owner, repo });
 *   return NextResponse.json(result);
 * });
 */
export async function withGithubAuth(
  req: NextRequest,
  orgName: Auth0OrgName,
  repoData: GithubIdentificationSchemeType,
  callback: (parsedRepo: ParsedRepoData) => Promise<NextResponse> | NextResponse
): Promise<NextResponse> {
  // Validate user session
  const sessionResult = await maybeGetCurrentSession(req);
  if (sessionResult.errorResponse != null) {
    return sessionResult.errorResponse;
  }
  const { userId } = sessionResult.data;

  // Validate user organization membership
  try {
    await assertUserHasOrganizationAccess({ userId, orgName });
  } catch (_) {
    return NextResponse.json(
      { error: "User is not a member of the specified organization" },
      { status: 403 }
    );
  }

  // Parse the repo data to create a RepoIdentifier and extract information
  let identifier: RepoIdentifier;
  let owner: string;
  let repo: string;
  let githubUrl: string;

  if ("githubUrl" in repoData) {
    // It's a GitHub URL
    githubUrl = repoData.githubUrl;
    identifier = { type: "url", githubUrl };

    const parsed = getOwnerAndRepoFromGithubUrl(githubUrl);

    if (parsed.owner == null || parsed.repo == null) {
      return NextResponse.json(
        { error: "Invalid GitHub URL format" },
        { status: 400 }
      );
    } else {
      owner = parsed.owner;
      repo = parsed.repo;
    }
  } else {
    // It's an object with owner and repo
    owner = repoData.owner;
    repo = repoData.repo;
    githubUrl = `https://github.com/${owner}/${repo}`;
    identifier = { type: "owner-repo", owner, repo };
  }

  // Validate GitHub access
  const validation = await validateGithubRepoAccess(
    orgName,
    repoData.site,
    identifier
  );

  if (!validation.ok) {
    const { error } = validation;
    const message = getValidationErrorMessage(error);
    let status: number;

    switch (error.type) {
      case "FERN_BOT_NOT_INSTALLED":
        status = 403;
        break;
      case "FERN_CONFIG_JSON_ORG_MISMATCH":
        status = 403;
        break;
      case "FERN_CONFIG_JSON_MISSING":
        status = 404;
        break;
      case "FERN_CONFIG_JSON_MALFORMED":
        status = 400;
        break;
      case "MALFORMED_GITHUB_URL":
        status = 400;
        break;
      case "UNEXPECTED_ERROR":
        status = 500;
        break;
      default:
        status = 500;
    }

    return NextResponse.json({ error: message }, { status });
  }

  // If we reach here, validation passed - execute the callback with parsed repo data
  return await callback({ owner, repo, site: repoData.site, githubUrl });
}
