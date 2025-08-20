// Extend the Error type to include the digest property
interface DigestibleError extends Error {
  digest: string;
}

export type ERROR_DIGEST_KEYS =
  | "BRANCH_NOT_FOUND"
  | "BASE_BRANCH_NOT_SET"
  | "SOURCE_REPO_NOT_FOUND"
  | "SOURCE_REPO_NOT_VALID"
  | "USER_NOT_IN_ORG"
  | "FERN_BOT_NOT_INSTALLED"
  | "WRITE_PERMISSION_ERROR";

export const ERROR_DIGEST_MESSAGES: Record<ERROR_DIGEST_KEYS, string> = {
  BRANCH_NOT_FOUND:
    "We were unable to find your working branch. Please confirm that the Github branch exists and has not been deleted.",
  BASE_BRANCH_NOT_SET:
    "Looks like your source repo is not configured correctly. Please set a base branch on your GitHub repo.",
  SOURCE_REPO_NOT_FOUND:
    "We were unable to find a GitHub repo for this Fern domain. Please confirm that you have linked a GitHub repo to this domain.",
  SOURCE_REPO_NOT_VALID:
    "We were unable to validate the GitHub repo associated with this domain. Please confirm that you have linked a valid GitHub URL to this Fern domain.",
  USER_NOT_IN_ORG:
    "You do not have access to this organization. Please contact an organization admin to be added.",
  FERN_BOT_NOT_INSTALLED:
    "Fern bot is not installed on this repo. Please contact your GitHub admin to ensure the Fern bot has access.",
  WRITE_PERMISSION_ERROR:
    "You do not have write permission to the underlying GitHub repo. Please contact your GitHub admin for access.",
};

export const throwDigestibleError = (
  rawError: Error,
  digest: ERROR_DIGEST_KEYS | string
): never => {
  const error = new Error(rawError.message) as DigestibleError;
  error.digest = digest;
  throw error;
};
