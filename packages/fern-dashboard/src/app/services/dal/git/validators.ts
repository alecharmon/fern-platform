import "server-only";

import type { FernConfigJsonErrors } from "@fern-api/docs-loader";

import { getValidationErrorMessage, throwDigestibleError } from "@/utils/errors";
import type { DocsUrl } from "@/utils/types";
import { parseGitUrl } from "../../git-common/url-utils";
import { getGitlabToken } from "../../gitlab/gitlab-token";
import { checkOrgWritePermissionToRepo } from "./checkOrgWritePermissionToRepo";
import type { RepoIdentifier } from "./types";

export type GitRepoValidationError =
    | { type: "REPO_NOT_CONNECTED" }
    | { type: "MALFORMED_GIT_URL"; url: string }
    | { type: "DOMAIN_NOT_REGISTERED" }
    | { type: "FERN_BOT_NOT_INSTALLED" }
    | { type: "FERN_CONFIG_JSON_ORG_MISMATCH" }
    | FernConfigJsonErrors
    | { type: "UNEXPECTED_ERROR"; message: string };

export type GitRepoValidationResult = { ok: true } | { ok: false; error: GitRepoValidationError };

// Cache for Git repo validation results
const gitValidationCache = new Map<string, { data: GitRepoValidationResult; timestamp: number }>();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

function getCacheKey(orgName: string, site: DocsUrl, identifier: RepoIdentifier): string {
    const repoKey = identifier.type === "url" ? identifier.gitUrl : `${identifier.owner}/${identifier.repo}`;
    return `${orgName}:${site}:${repoKey}`;
}

function deriveGitUrl(identifier: RepoIdentifier): string {
    if (identifier.type === "url") {
        return identifier.gitUrl;
    }
    return `https://github.com/${identifier.owner}/${identifier.repo}`;
}

export const validateGitRepoAccess = async (
    orgName: string,
    site: DocsUrl,
    identifier: RepoIdentifier,
    skipCache: boolean = false
): Promise<GitRepoValidationResult> => {
    const cacheKey = getCacheKey(orgName, site, identifier);
    const cached = gitValidationCache.get(cacheKey);

    // Return cached result if still fresh
    if (!skipCache && cached && Date.now() - cached.timestamp < CACHE_DURATION) {
        return cached.data;
    }

    const gitUrl = deriveGitUrl(identifier);

    try {
        const result = await checkOrgWritePermissionToRepo(orgName, site, gitUrl);

        const validationResult: GitRepoValidationResult = result.ok ? { ok: true } : { ok: false, error: result.error };

        // Cache the validation result
        gitValidationCache.set(cacheKey, {
            data: validationResult,
            timestamp: Date.now()
        });

        return validationResult;
    } catch (error) {
        // In case of unexpected errors, cache negative result for shorter duration
        const failedValidation: GitRepoValidationResult = {
            ok: false,
            error: {
                type: "UNEXPECTED_ERROR",
                message: error instanceof Error ? error.message : "Unknown error"
            }
        };

        gitValidationCache.set(cacheKey, {
            data: failedValidation,
            timestamp: Date.now() - CACHE_DURATION / 2 // Shorter cache for failures
        });

        return failedValidation;
    }
};

/**
 * Asserts that the organization has required Git access for components.
 *
 * @throws {DigestibleError} if the organization does not have required access
 */
export async function assertGitAccess(orgName: string, site: DocsUrl, identifier: RepoIdentifier): Promise<void> {
    const validation = await validateGitRepoAccess(orgName, site, identifier);

    if (!validation.ok) {
        const { error } = validation;
        throwDigestibleError(new Error(`${error.type}: ${getValidationErrorMessage(error)}`), error.type);
    }
}

export async function assertGitAccessByUrl(orgName: string, site: DocsUrl, gitUrl: string): Promise<void> {
    const identifier: RepoIdentifier = { type: "url", gitUrl };
    await assertGitAccess(orgName, site, identifier);
}

/**
 * Asserts that the organization has required access for the repository (GitHub or GitLab).
 * Routes to appropriate provider-specific validation based on URL.
 *
 * @throws {DigestibleError} if the organization does not have required access
 */
/**
 * Validates repository access for any git provider (GitHub or GitLab).
 * Returns a result object instead of throwing errors.
 */
export async function validateRepoAccess(
    orgName: string,
    site: DocsUrl,
    url: string
): Promise<GitRepoValidationResult> {
    const parsed = parseGitUrl(url);

    if (parsed.provider === "github") {
        return await validateGitRepoAccess(orgName, site, { type: "url", gitUrl: url }, false);
    } else if (parsed.provider === "gitlab") {
        try {
            await assertGitlabAccessByUrl(orgName, site, url);
            return { ok: true };
        } catch (error) {
            // Extract error information from the digestible error
            if (error instanceof Error && "digest" in error) {
                const digest = (error as any).digest as string;
                return {
                    ok: false,
                    error: {
                        type: digest as any,
                        message: error.message
                    } as GitRepoValidationError
                };
            }
            return {
                ok: false,
                error: {
                    type: "UNEXPECTED_ERROR",
                    message: error instanceof Error ? error.message : "Unknown error"
                }
            };
        }
    } else {
        return {
            ok: false,
            error: {
                type: "MALFORMED_GIT_URL",
                url
            }
        };
    }
}

export async function assertRepoAccessByUrl(orgName: string, site: DocsUrl, url: string): Promise<void> {
    const parsed = parseGitUrl(url);

    if (parsed.provider === "github") {
        await assertGitAccessByUrl(orgName, site, url);
    } else if (parsed.provider === "gitlab") {
        await assertGitlabAccessByUrl(orgName, site, url);
    } else {
        throwDigestibleError(new Error(`Unknown provider for URL: ${url}`), "MALFORMED_GIT_URL");
    }
}

/**
 * Asserts that the organization has required GitLab access.
 *
 * @throws {DigestibleError} if the organization does not have required access
 */
async function assertGitlabAccessByUrl(orgName: string, site: DocsUrl, gitlabUrl: string): Promise<void> {
    const parsed = parseGitUrl(gitlabUrl);

    if (!parsed.owner || !parsed.repo) {
        throwDigestibleError(new Error(`Invalid GitLab URL: ${gitlabUrl}`), "MALFORMED_GIT_URL");
    }

    const token = await getGitlabToken(parsed.owner, parsed.repo);

    if (!token) {
        throwDigestibleError(
            new Error("Please contact Fern Support to set up a GitLab repository."),
            "GITLAB_TOKEN_NOT_CONFIGURED"
        );
    }
}
