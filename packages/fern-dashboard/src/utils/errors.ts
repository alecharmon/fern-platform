import type { GithubRepoValidationError } from "@/app/services/dal/github/validators";

// Extend the Error type to include the digest property
interface DigestibleError extends Error {
  digest: string;
}

// Extract GitHub validation error keys from the source type
type GithubValidationErrorKeys = GithubRepoValidationError["type"];

export type ERROR_DIGEST_KEYS =
  | "BRANCH_NOT_FOUND"
  | "BASE_BRANCH_NOT_SET"
  | "USER_NOT_IN_ORG"
  | "WRITE_PERMISSION_ERROR"
  | GithubValidationErrorKeys;

export const ERROR_DIGEST_MESSAGES: Record<ERROR_DIGEST_KEYS, string> = {
  BRANCH_NOT_FOUND:
    "We were unable to find your working branch. Please confirm that the Github branch exists and has not been deleted.",
  BASE_BRANCH_NOT_SET:
    "Looks like your source repo is not configured correctly. Please set a base branch on your GitHub repo.",
  REPO_NOT_FOUND:
    "We were unable to find a GitHub repo for this Fern domain. Please confirm that you have linked a GitHub repo to this domain.",
  USER_NOT_IN_ORG:
    "You do not have access to this organization. Please contact an organization admin to be added.",
  FERN_BOT_NOT_INSTALLED:
    "Fern bot is not installed on this repo. Please contact your GitHub admin to ensure the Fern bot has access.",
  WRITE_PERMISSION_ERROR:
    "You do not have write permission to the underlying GitHub repo. Please contact your GitHub admin for access.",
  MALFORMED_GITHUB_URL:
    "The provided GitHub URL is not valid. Please ensure you're using a valid GitHub repository URL.",
  FERN_CONFIG_JSON_ORG_MISMATCH:
    "The organization in fern.config.json does not match your current organization. Please update the configuration file.",
  FERN_CONFIG_JSON_MISSING:
    "The fern.config.json file was not found in the repository. Please ensure the configuration file exists in the root directory.",
  FERN_CONFIG_JSON_MALFORMED:
    "The fern.config.json file is malformed or contains invalid JSON. Please check the file syntax.",
  SITE_NOT_FOUND:
    "Your repository has one or more Fern projects, however, none of the projects are configured for this docs site.",
  MULTIPLE_PROJECTS_WITH_SITE:
    "Your repository has more than one Fern project that is configured for this docs site. Only one Fern project can be configured for a docs site.",
  NO_PROJECTS: "No valid fern projects were detected in your repository.",
  UNEXPECTED_ERROR:
    "An unexpected error occurred while validating the repository. Please try again or contact support if the issue persists.",
};
/**
 * Gets a human-readable error message for a GitHub validation error
 */
export function getValidationErrorMessage(
  error: GithubRepoValidationError
): string {
  switch (error.type) {
    case "MALFORMED_GITHUB_URL":
      return `${ERROR_DIGEST_MESSAGES.MALFORMED_GITHUB_URL} URL: ${error.url}`;
    case "FERN_BOT_NOT_INSTALLED":
      return ERROR_DIGEST_MESSAGES.FERN_BOT_NOT_INSTALLED;
    case "FERN_CONFIG_JSON_ORG_MISMATCH":
      return ERROR_DIGEST_MESSAGES.FERN_CONFIG_JSON_ORG_MISMATCH;
    case "FERN_CONFIG_JSON_MISSING":
      return ERROR_DIGEST_MESSAGES.FERN_CONFIG_JSON_MISSING;
    case "FERN_CONFIG_JSON_MALFORMED":
      return ERROR_DIGEST_MESSAGES.FERN_CONFIG_JSON_MALFORMED;
    case "REPO_NOT_FOUND":
      return ERROR_DIGEST_MESSAGES.REPO_NOT_FOUND;
    case "SITE_NOT_FOUND":
      return ERROR_DIGEST_MESSAGES.SITE_NOT_FOUND;
    case "MULTIPLE_PROJECTS_WITH_SITE":
      return ERROR_DIGEST_MESSAGES.MULTIPLE_PROJECTS_WITH_SITE;
    case "NO_PROJECTS":
      return ERROR_DIGEST_MESSAGES.NO_PROJECTS;
    case "UNEXPECTED_ERROR":
      return `${ERROR_DIGEST_MESSAGES.UNEXPECTED_ERROR} Details: ${error.message}`;
    default:
      return ERROR_DIGEST_MESSAGES.UNEXPECTED_ERROR;
  }
}

export const throwDigestibleError = (
  rawError: Error,
  digest: ERROR_DIGEST_KEYS | string
): never => {
  const error = new Error(rawError.message) as DigestibleError;
  error.digest = digest;
  throw error;
};
