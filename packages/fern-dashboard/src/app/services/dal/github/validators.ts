import "server-only";

import type { FernConfigJsonErrors } from "@fern-api/docs-loader";

import { getValidationErrorMessage, throwDigestibleError } from "@/utils/errors";

import { checkOrgWritePermissionToRepo } from "./checkOrgWritePermissionToRepo";
import type { RepoIdentifier } from "./types";

export type GithubRepoValidationError =
    | { type: "REPO_NOT_CONNECTED" }
    | { type: "MALFORMED_GITHUB_URL"; url: string }
    | { type: "FERN_BOT_NOT_INSTALLED" }
    | { type: "FERN_CONFIG_JSON_ORG_MISMATCH" }
    | FernConfigJsonErrors
    | { type: "UNEXPECTED_ERROR"; message: string };

export type GithubRepoValidationResult = { ok: true } | { ok: false; error: GithubRepoValidationError };

// Cache for GitHub repo validation results
const githubValidationCache = new Map<string, { data: GithubRepoValidationResult; timestamp: number }>();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

function getCacheKey(orgName: string, identifier: RepoIdentifier): string {
    const repoKey = identifier.type === "url" ? identifier.githubUrl : `${identifier.owner}/${identifier.repo}`;
    return `${orgName}:${repoKey}`;
}

function deriveGithubUrl(identifier: RepoIdentifier): string {
    if (identifier.type === "url") {
        return identifier.githubUrl;
    }
    return `https://github.com/${identifier.owner}/${identifier.repo}`;
}

export const validateGithubRepoAccess = async (
    orgName: string,
    site: string,
    identifier: RepoIdentifier,
    skipCache: boolean = false
): Promise<GithubRepoValidationResult> => {
    const cacheKey = getCacheKey(orgName, identifier);
    const cached = githubValidationCache.get(cacheKey);

    // Return cached result if still fresh
    if (!skipCache && cached && Date.now() - cached.timestamp < CACHE_DURATION) {
        return cached.data;
    }

    const githubUrl = deriveGithubUrl(identifier);

    try {
        const result = await checkOrgWritePermissionToRepo(orgName, site, githubUrl);

        const validationResult: GithubRepoValidationResult = result.ok
            ? { ok: true }
            : { ok: false, error: result.error };

        // Cache the validation result
        githubValidationCache.set(cacheKey, {
            data: validationResult,
            timestamp: Date.now()
        });

        return validationResult;
    } catch (error) {
        // In case of unexpected errors, cache negative result for shorter duration
        const failedValidation: GithubRepoValidationResult = {
            ok: false,
            error: {
                type: "UNEXPECTED_ERROR",
                message: error instanceof Error ? error.message : "Unknown error"
            }
        };

        githubValidationCache.set(cacheKey, {
            data: failedValidation,
            timestamp: Date.now() - CACHE_DURATION / 2 // Shorter cache for failures
        });

        return failedValidation;
    }
};

/**
 * Asserts that the organization has required GitHub access for components.
 *
 * @throws {DigestibleError} if the organization does not have required access
 */
export async function assertGithubAccess(orgName: string, site: string, identifier: RepoIdentifier): Promise<void> {
    const validation = await validateGithubRepoAccess(orgName, site, identifier);

    if (!validation.ok) {
        const { error } = validation;
        throwDigestibleError(new Error(`${error.type}: ${getValidationErrorMessage(error)}`), error.type);
    }
}

export async function assertGithubAccessByUrl(orgName: string, site: string, githubUrl: string): Promise<void> {
    const identifier: RepoIdentifier = { type: "url", githubUrl };
    await assertGithubAccess(orgName, site, identifier);
}
