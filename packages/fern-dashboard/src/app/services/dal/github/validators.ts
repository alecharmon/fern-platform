import "server-only";

import { Auth0UserID } from "@/app/services/auth0/types";
import { checkUserHasWritePermissionToRepo } from "@/app/services/dal/github/checkWritePermissionToRepo";
import { throwDigestibleError } from "@/utils/errors";

import { checkFernHasAccessToRepo } from "./checkFernHasAccessToRepo";
import { RepoIdentifier } from "./types";

interface GithubRepoValidation {
  hasWriteAccess: boolean;
  hasFernBotInstalled: boolean;
  repoExists: boolean;
}

// Cache for GitHub repo validation results
const githubValidationCache = new Map<
  string,
  { data: GithubRepoValidation; timestamp: number }
>();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

function getCacheKey(userId: Auth0UserID, identifier: RepoIdentifier): string {
  const repoKey =
    identifier.type === "url"
      ? identifier.githubUrl
      : `${identifier.owner}/${identifier.repo}`;
  return `${userId}:${repoKey}`;
}

function deriveGithubUrl(identifier: RepoIdentifier): string {
  if (identifier.type === "url") {
    return identifier.githubUrl;
  }
  return `https://github.com/${identifier.owner}/${identifier.repo}`;
}

export const validateGithubRepoAccess = async (
  userId: Auth0UserID,
  identifier: RepoIdentifier
): Promise<GithubRepoValidation> => {
  const cacheKey = getCacheKey(userId, identifier);
  const cached = githubValidationCache.get(cacheKey);

  // Return cached result if still fresh
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.data;
  }

  const githubUrl = deriveGithubUrl(identifier);

  // Initialize validation result
  const validation: GithubRepoValidation = {
    hasWriteAccess: false,
    hasFernBotInstalled: false,
    repoExists: false,
  };

  try {
    // Check both user permissions and Fern bot access in parallel
    const [hasWriteAccess, hasFernBotInstalled] = await Promise.allSettled([
      checkUserHasWritePermissionToRepo(userId, githubUrl),
      checkFernHasAccessToRepo(githubUrl),
    ]);

    // Process write permission result
    if (hasWriteAccess.status === "fulfilled" && hasWriteAccess.value) {
      validation.hasWriteAccess = true;
      validation.repoExists = true; // If we have write access, repo exists
    }

    // Process Fern bot access result
    if (
      hasFernBotInstalled.status === "fulfilled" &&
      hasFernBotInstalled.value
    ) {
      validation.hasFernBotInstalled = true;
      validation.repoExists = true; // If Fern bot has access, repo exists
    }

    // Cache the validation result
    githubValidationCache.set(cacheKey, {
      data: validation,
      timestamp: Date.now(),
    });

    return validation;
  } catch (_error) {
    // In case of unexpected errors, cache negative result for shorter duration
    const failedValidation: GithubRepoValidation = {
      hasWriteAccess: false,
      hasFernBotInstalled: false,
      repoExists: false,
    };

    githubValidationCache.set(cacheKey, {
      data: failedValidation,
      timestamp: Date.now() - CACHE_DURATION / 2, // Shorter cache for failures
    });

    return failedValidation;
  }
};

/**
 * Asserts that the user has required GitHub access for components.
 *
 * @throws {DigestibleError} if the user does not have required access
 */
export async function assertGithubAccess(
  userId: Auth0UserID,
  identifier: RepoIdentifier
): Promise<void> {
  const validation = await validateGithubRepoAccess(userId, identifier);
  if (!validation.hasFernBotInstalled) {
    throw throwDigestibleError(
      new Error("Fern bot is not installed on this repo"),
      "FERN_BOT_NOT_INSTALLED"
    );
  }

  if (!validation.hasWriteAccess) {
    throw throwDigestibleError(
      new Error("User does not have write permission to this repo"),
      "WRITE_PERMISSION_ERROR"
    );
  }

  if (!validation.repoExists) {
    throw throwDigestibleError(
      new Error("GitHub repository not found or not accessible"),
      "REPO_NOT_FOUND"
    );
  }
}

export async function assertGithubAccessByUrl(
  userId: Auth0UserID,
  githubUrl?: string
): Promise<void> {
  if (githubUrl == null) {
    throw throwDigestibleError(
      new Error("GitHub URL is required"),
      "GITHUB_URL_REQUIRED"
    );
  }
  const identifier: RepoIdentifier = { type: "url", githubUrl };
  await assertGithubAccess(userId, identifier);
}
