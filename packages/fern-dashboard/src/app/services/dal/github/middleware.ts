import "server-only";

import { type NextRequest, NextResponse } from "next/server";

import { maybeGetCurrentSession } from "@/app/api/utils/maybeGetCurrentSession";
import type { Auth0OrgName, Auth0UserID } from "@/app/services/auth0/types";
import { getValidationErrorMessage } from "@/utils/errors";
import { parseDocsUrlParam } from "@/utils/parseDocsUrlParam";
import type { DocsUrl } from "@/utils/types";
import { getOwnerAndRepoFromGithubUrl } from "../../github/github";
import { assertUserHasOrganizationAccess } from "../organization";
import type { GithubIdentificationSchemeType, RepoIdentifier } from "./types";
import { type GithubRepoValidationError, validateGithubRepoAccess } from "./validators";

export interface ParsedRepoData {
    owner: string;
    repo: string;
    site: DocsUrl;
    githubUrl: string;
}

export type AuthError =
    | { type: "SESSION_ERROR"; message: string }
    | { type: "ORG_ACCESS_ERROR"; message: string }
    | { type: "GITHUB_URL_ERROR"; message: string }
    | {
          type: "GITHUB_ACCESS_ERROR";
          validationError: GithubRepoValidationError;
      };

export type AuthResult = { ok: true; value: ParsedRepoData } | { ok: false; error: AuthError };

export async function withGithubAuth<T>(
    userId: Auth0UserID,
    token: string,
    orgName: Auth0OrgName,
    repoData: GithubIdentificationSchemeType,
    callback: (authResult: AuthResult) => Promise<T>
): Promise<T> {
    // Build the AuthResult by running all validations
    let authResult: AuthResult;

    // Validate user organization membership
    try {
        await assertUserHasOrganizationAccess(token, orgName);

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
                authResult = {
                    ok: false,
                    error: {
                        type: "GITHUB_URL_ERROR",
                        message: "Invalid GitHub URL format"
                    }
                };
            } else {
                owner = parsed.owner;
                repo = parsed.repo;

                // Validate GitHub access
                const validation = await validateGithubRepoAccess(
                    orgName,
                    parseDocsUrlParam({ docsUrl: repoData.site }),
                    identifier
                );

                if (!validation.ok) {
                    authResult = {
                        ok: false,
                        error: {
                            type: "GITHUB_ACCESS_ERROR",
                            validationError: validation.error
                        }
                    };
                } else {
                    // All validations passed
                    authResult = {
                        ok: true,
                        value: {
                            owner,
                            repo,
                            site: parseDocsUrlParam({ docsUrl: repoData.site }),
                            githubUrl
                        }
                    };
                }
            }
        } else {
            // It's an object with owner and repo
            owner = repoData.owner;
            repo = repoData.repo;
            githubUrl = `https://github.com/${owner}/${repo}`;
            identifier = { type: "owner-repo", owner, repo };

            // Validate GitHub access
            const validation = await validateGithubRepoAccess(
                orgName,
                parseDocsUrlParam({ docsUrl: repoData.site }),
                identifier
            );

            if (!validation.ok) {
                authResult = {
                    ok: false,
                    error: {
                        type: "GITHUB_ACCESS_ERROR",
                        validationError: validation.error
                    }
                };
            } else {
                // All validations passed
                authResult = {
                    ok: true,
                    value: {
                        owner,
                        repo,
                        site: parseDocsUrlParam({ docsUrl: repoData.site }),
                        githubUrl
                    }
                };
            }
        }
    } catch (_) {
        authResult = {
            ok: false,
            error: {
                type: "ORG_ACCESS_ERROR",
                message: "User is not a member of the specified organization"
            }
        };
    }

    // Execute the callback with the AuthResult
    const result = await callback(authResult);
    return result;
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
 * return withGithubAuthNextRoute(req, orgName, repoData, async ({ owner, repo, githubUrl }) => {
 *   const result = await someGitOperation({ owner, repo });
 *   return NextResponse.json(result);
 * });
 */
export async function withGithubAuthNextRoute(
    req: NextRequest,
    orgName: Auth0OrgName,
    repoData: GithubIdentificationSchemeType,
    callback: (parsedRepo: ParsedRepoData) => Promise<NextResponse>
): Promise<NextResponse> {
    // Validate user session
    const sessionResult = await maybeGetCurrentSession(req);
    if (sessionResult.errorResponse != null) {
        return sessionResult.errorResponse;
    }

    return withGithubAuth(
        sessionResult.data.userId,
        sessionResult.data.token,
        orgName,
        repoData,
        async (authResult) => {
            // Check if the authResult contains an error
            if (!authResult.ok) {
                const { error } = authResult;
                let status: number;
                let message: string;

                switch (error.type) {
                    case "SESSION_ERROR":
                        status = 401;
                        message = error.message;
                        break;
                    case "ORG_ACCESS_ERROR":
                        status = 403;
                        message = error.message;
                        break;
                    case "GITHUB_URL_ERROR":
                        status = 400;
                        message = error.message;
                        break;
                    case "GITHUB_ACCESS_ERROR":
                        message = getValidationErrorMessage(error.validationError);
                        // Map validation error types to HTTP status codes
                        switch (error.validationError.type) {
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
                        break;
                    default:
                        status = 500;
                        message = "Unknown error";
                }

                return NextResponse.json({ error: message }, { status });
            }

            // Otherwise, we have valid parsed repo data - call the original callback
            const result = await callback(authResult.value);
            return result;
        }
    );
}
