import "server-only";

import type { FernConfigJsonErrors } from "@fern-api/docs-loader";

import { parseGitUrl } from "@/app/services/git-common/url-utils";
import { isGheUrl } from "@/app/services/github/ghe-config";
import { GitLabLoader } from "@/app/services/gitlab/gitlab-loader";
import { getGitlabToken } from "@/app/services/gitlab/gitlab-token";
import type { DocsUrl } from "@/utils/types";

import { checkOrgWritePermissionToRepo } from "../github/checkOrgWritePermissionToRepo";

/**
 * The detected provider for a git URL.
 * - "github": github.com repository
 * - "github-enterprise": GitHub Enterprise instance (configured in edge config)
 * - "gitlab": GitLab repository
 * - "unknown": Could not determine provider
 */
export type GitProvider = "github" | "github-enterprise" | "gitlab" | "unknown";

/**
 * All possible validation errors for git repositories.
 */
export type GitRepoValidationError =
    | { type: "REPO_NOT_CONNECTED" }
    | { type: "MALFORMED_GIT_URL"; url: string }
    | { type: "DOMAIN_NOT_REGISTERED" }
    | { type: "FERN_BOT_NOT_INSTALLED" }
    | { type: "GHE_APP_NOT_INSTALLED" }
    | { type: "EDGE_CONFIG_ERROR"; message: string }
    | { type: "FERN_CONFIG_JSON_ORG_MISMATCH" }
    | { type: "GITLAB_TOKEN_NOT_CONFIGURED" }
    | { type: "GITLAB_API_ERROR"; message: string }
    | FernConfigJsonErrors
    | { type: "UNEXPECTED_ERROR"; message: string };

/**
 * Result of validating a git repository.
 */
export type ValidateGitRepoResult =
    | {
          ok: true;
          provider: GitProvider;
          owner: string;
          repo: string;
          canonicalUrl: string;
      }
    | {
          ok: false;
          provider: GitProvider;
          error: GitRepoValidationError;
      };

/**
 * Normalizes a URL by adding https:// if no protocol is present.
 */
function normalizeUrl(url: string): string {
    const trimmed = url.trim();
    if (!trimmed) {
        return trimmed;
    }
    if (!trimmed.startsWith("http://") && !trimmed.startsWith("https://")) {
        return `https://${trimmed}`;
    }
    return trimmed;
}

/**
 * Checks if a URL is specifically for github.com (not a GHE instance).
 */
function isGithubDotCom(url: string): boolean {
    try {
        const normalizedUrl = normalizeUrl(url);
        const parsedUrl = new URL(normalizedUrl);
        const host = parsedUrl.host.toLowerCase();
        return host === "github.com" || host === "www.github.com";
    } catch {
        return false;
    }
}

/**
 * Determines the provider for a git URL by checking:
 * 1. Is it specifically github.com?
 * 2. Is it a GitHub Enterprise URL? (configured in edge config)
 * 3. Is it a GitLab URL?
 * 4. Unknown
 */
async function detectProvider(gitUrl: string): Promise<GitProvider> {
    const normalizedUrl = normalizeUrl(gitUrl);

    // First check if it's specifically github.com
    if (isGithubDotCom(normalizedUrl)) {
        return "github";
    }

    // Check if it's a GHE URL (this requires edge config lookup)
    const isGhe = await isGheUrl(normalizedUrl);
    if (isGhe) {
        return "github-enterprise";
    }

    // Parse the URL to detect provider from hostname
    const parsed = parseGitUrl(normalizedUrl);

    if (parsed.provider === "gitlab") {
        return "gitlab";
    }

    // If parseGitUrl detected "github" but it's not github.com and not in edge config,
    // it's an unconfigured GHE instance - treat as unknown
    if (parsed.provider === "github") {
        return "unknown";
    }

    return "unknown";
}

/**
 * Builds the canonical URL for a git repository.
 */
function buildCanonicalUrl(gitUrl: string, provider: GitProvider, owner: string, repo: string): string {
    if (provider === "github") {
        return `https://github.com/${owner}/${repo}`;
    }

    if (provider === "gitlab") {
        return `https://gitlab.com/${owner}/${repo}`;
    }

    // For GHE and unknown, try to construct from the original URL
    try {
        const normalizedUrl = normalizeUrl(gitUrl);
        const url = new URL(normalizedUrl);
        return `https://${url.host}/${owner}/${repo}`;
    } catch {
        return gitUrl;
    }
}

/**
 * Unified validation for all git repository types (GitHub, GitLab, GHE).
 *
 * This is the single source of truth for validating git repository access.
 * Both the input validation endpoint and the connect endpoint should use this function.
 *
 * @param orgName - The Fern organization name
 * @param site - The docs site URL
 * @param gitUrl - The git repository URL to validate
 * @returns Validation result with provider info, owner/repo, and canonical URL on success
 */
export async function validateGitRepoAccess(
    orgName: string,
    site: DocsUrl,
    gitUrl: string
): Promise<ValidateGitRepoResult> {
    console.log(`[validateGitRepoAccess] Starting: orgName=${orgName}, site=${site}, gitUrl=${gitUrl}`);
    const normalizedGitUrl = normalizeUrl(gitUrl);

    // Detect the provider server-side
    const provider = await detectProvider(normalizedGitUrl);
    console.log(`[validateGitRepoAccess] Detected provider: ${provider}`);

    // Parse the URL to get owner/repo
    const parsed = parseGitUrl(normalizedGitUrl);
    const { owner, repo } = parsed;
    console.log(`[validateGitRepoAccess] Parsed: owner=${owner}, repo=${repo}`);

    if (!owner || !repo) {
        console.error(`[validateGitRepoAccess] Failed: MALFORMED_GIT_URL`);
        return {
            ok: false,
            provider,
            error: { type: "MALFORMED_GIT_URL", url: gitUrl }
        };
    }

    const canonicalUrl = buildCanonicalUrl(normalizedGitUrl, provider, owner, repo);
    console.log(`[validateGitRepoAccess] Canonical URL: ${canonicalUrl}`);

    // Route to appropriate validation based on provider
    if (provider === "gitlab") {
        // GitLab validation - check if we have a token configured
        const gitlabToken = await getGitlabToken(owner, repo);
        if (!gitlabToken) {
            return {
                ok: false,
                provider,
                error: { type: "GITLAB_TOKEN_NOT_CONFIGURED" }
            };
        }

        // Validate fern.config.json exists and org matches (same as GitHub)
        // Wrap in try-catch to handle GitLab API errors (e.g., expired token, network issues)
        try {
            const gitlabLoader = new GitLabLoader({ owner, repo });
            const fernConfigResult = await gitlabLoader.getFernConfigJson(owner, repo, site);

            if (fernConfigResult.type !== "ok") {
                return {
                    ok: false,
                    provider,
                    error: fernConfigResult.error
                };
            }

            if (fernConfigResult.result.organization !== orgName) {
                return {
                    ok: false,
                    provider,
                    error: { type: "FERN_CONFIG_JSON_ORG_MISMATCH" }
                };
            }

            return {
                ok: true,
                provider,
                owner,
                repo,
                canonicalUrl
            };
        } catch (error) {
            console.error("[validateGitRepoAccess] GitLab API error:", error);
            const errorMessage =
                error instanceof Error ? error.message : "An unexpected error occurred while validating the repository";
            return {
                ok: false,
                provider,
                error: {
                    type: "GITLAB_API_ERROR",
                    message: errorMessage
                }
            };
        }
    }

    if (provider === "github" || provider === "github-enterprise") {
        // GitHub/GHE validation
        console.log(`[validateGitRepoAccess] Checking GitHub permissions for ${owner}/${repo}`);
        const result = await checkOrgWritePermissionToRepo(
            orgName,
            site,
            normalizedGitUrl,
            true // skip cache for immediate feedback
        );

        if (result.ok) {
            console.log(`[validateGitRepoAccess] GitHub validation passed`);
            return {
                ok: true,
                provider,
                owner,
                repo,
                canonicalUrl
            };
        }

        console.error(`[validateGitRepoAccess] GitHub validation failed:`, JSON.stringify(result.error, null, 2));
        return {
            ok: false,
            provider,
            error: result.error
        };
    }

    // Unknown provider
    return {
        ok: false,
        provider,
        error: { type: "MALFORMED_GIT_URL", url: gitUrl }
    };
}
