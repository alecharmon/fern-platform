import type { GitRepoValidationError } from "@/app/services/dal/git/validators";

// Extend the Error type to include the digest property
interface DigestibleError extends Error {
    digest: string;
}

// Extract GitHub validation error keys from the source type
type GithubValidationErrorKeys = GitRepoValidationError["type"];

export type ERROR_DIGEST_KEYS =
    | "BRANCH_NOT_FOUND"
    | "BASE_BRANCH_NOT_SET"
    | "USER_NOT_IN_ORG"
    | "WRITE_PERMISSION_ERROR"
    | "GITLAB_TOKEN_NOT_CONFIGURED"
    | "MALFORMED_GIT_URL"
    | GithubValidationErrorKeys;

export const ERROR_DIGEST_MESSAGES: Record<ERROR_DIGEST_KEYS, string> = {
    BRANCH_NOT_FOUND:
        "We were unable to find your working branch. Please confirm that the branch exists and has not been deleted.",
    BASE_BRANCH_NOT_SET:
        "Looks like your source repository is not configured correctly. Please set a base branch on your repository.",
    REPO_NOT_CONNECTED: "Please connect your repository above.",
    REPO_NOT_FOUND: "We were unable to locate the repository connected to this site. Please contact support.",
    USER_NOT_IN_ORG: "You do not have access to this organization. Please contact an organization admin to be added.",
    FERN_BOT_NOT_INSTALLED:
        "Fern bot is not installed on this repo. Please contact your GitHub admin to ensure the Fern bot has access.",
    WRITE_PERMISSION_ERROR:
        "You do not have write permission to the underlying repository. Please contact your repository admin for access.",
    GITLAB_TOKEN_NOT_CONFIGURED: "Please contact Fern Support to set up a GitLab repository.",
    MALFORMED_GIT_URL:
        "The provided repository URL is not valid. Please ensure you're using a valid GitHub or GitLab repository URL.",
    DOMAIN_NOT_REGISTERED: "This docs domain is not registered. Please contact support to register your domain.",
    FERN_CONFIG_JSON_ORG_MISMATCH:
        "The organization in fern.config.json does not match your current organization. Please update the configuration file.",
    FERN_CONFIG_JSON_MISSING:
        "The fern.config.json file was not found in the repository. Please ensure the configuration file exists in the root directory.",
    FERN_CONFIG_JSON_MALFORMED:
        "The fern.config.json file is malformed or contains invalid JSON. Please check the file syntax.",
    SITE_NOT_FOUND: "Your repository contains one or more Fern projects, but is missing a valid instance URL.",
    MULTIPLE_PROJECTS_WITH_SITE:
        "Your repository has more than one Fern project that is configured for this docs site. Only one Fern project can be configured for a docs site.",
    NO_PROJECTS: "No valid fern projects were detected in your repository.",
    UNEXPECTED_ERROR:
        "An unexpected error occurred while validating the repository. Please try again or contact support if the issue persists."
};
/**
 * Gets a human-readable error message for a GitHub validation error
 */
export function getValidationErrorMessage(error: GitRepoValidationError): string {
    switch (error.type) {
        case "REPO_NOT_CONNECTED":
            return ERROR_DIGEST_MESSAGES.REPO_NOT_CONNECTED;
        case "MALFORMED_GIT_URL":
            return `${ERROR_DIGEST_MESSAGES.MALFORMED_GIT_URL} URL: ${error.url}`;
        case "DOMAIN_NOT_REGISTERED":
            return ERROR_DIGEST_MESSAGES.DOMAIN_NOT_REGISTERED;
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
        case "SITE_NOT_FOUND": {
            if (error.foundSites && error.foundSites.length > 0) {
                return "Your repository is not configured for the site you're trying to access. Please check your docs.yml and ensure your site is listed.";
            }
            return ERROR_DIGEST_MESSAGES.SITE_NOT_FOUND;
        }
        case "MULTIPLE_PROJECTS_WITH_SITE":
            return ERROR_DIGEST_MESSAGES.MULTIPLE_PROJECTS_WITH_SITE;
        case "NO_PROJECTS":
            return ERROR_DIGEST_MESSAGES.NO_PROJECTS;
        case "UNEXPECTED_ERROR":
            return `${ERROR_DIGEST_MESSAGES.UNEXPECTED_ERROR} Details: ${error.message}`;
        default: {
            // This ensures we handle all cases exhaustively
            // If a new error type is added, TypeScript will error here
            const _exhaustiveCheck: never = error;
            throw new TypeError(`Unhandled error type: ${JSON.stringify(error)}`);
        }
    }
}

export const throwDigestibleError = (rawError: Error, digest: ERROR_DIGEST_KEYS | string): never => {
    const error = new Error(rawError.message) as DigestibleError;
    error.digest = digest;
    throw error;
};
