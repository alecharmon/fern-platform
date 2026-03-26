import "server-only";

import {
    type GitProvider,
    type GitRepoValidationError,
    type ValidateGitRepoResult,
    validateGitRepoAccess
} from "@/app/services/dal/git/validateGitRepoAccess";
import { parseDocsUrlParam } from "@/utils/parseDocsUrlParam";
import type { DocsUrl } from "@/utils/types";

import { getDocsUrlMetadata } from "../utils/getDocsUrlMetadata";

export interface ValidateGitRepoRequest {
    url: DocsUrl;
    token: string;
    gitUrl: string;
    forceRefresh?: boolean;
}

// Re-export types for consumers
export type { GitProvider, GitRepoValidationError, ValidateGitRepoResult };

/**
 * Response type for the unified git repo validation endpoint.
 */
export type ValidateGitRepoResponse = ValidateGitRepoResult;

/**
 * Simplified access check result for UI components.
 */
export type GitRepoAccessCheckResult =
    | {
          ok: true;
          appInstalled: true;
      }
    | {
          ok: false;
          appInstalled: boolean;
          error: GitRepoValidationError;
      };

/**
 * Handler for validating git repository access.
 *
 * This handler:
 * 1. Gets the org name from docs URL metadata
 * 2. Delegates to the unified validateGitRepoAccess function
 *
 * The client should only perform basic URL syntax validation before calling this.
 */
export default async function handler({
    url,
    token,
    gitUrl,
    forceRefresh
}: ValidateGitRepoRequest): Promise<ValidateGitRepoResponse> {
    // Get docs URL metadata for org validation
    const docsUrlMetadata = await getDocsUrlMetadata({ url, token });
    if (!docsUrlMetadata.ok) {
        if (docsUrlMetadata.error.error === "DomainNotRegisteredError") {
            return {
                ok: false,
                provider: "unknown",
                error: { type: "DOMAIN_NOT_REGISTERED" }
            };
        }
        console.error("Failed to load docs URL metadata", JSON.stringify(docsUrlMetadata.error));
        return {
            ok: false,
            provider: "unknown",
            error: {
                type: "UNEXPECTED_ERROR",
                message: "Failed to load docs URL metadata"
            }
        };
    }

    const orgName = docsUrlMetadata.body.org;
    const site = parseDocsUrlParam({ docsUrl: url });

    // Use the unified validation function
    return validateGitRepoAccess(orgName, site, gitUrl, { forceRefresh });
}
