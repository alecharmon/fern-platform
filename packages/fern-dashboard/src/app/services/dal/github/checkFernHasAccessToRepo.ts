import "server-only";

import { getFernBotOctokitForRepo } from "@/app/services/auth0/fernBotOctokit";
import { getOwnerAndRepoFromGithubUrl } from "@/app/services/github/github";

/**
 * Checks if the fern GitHub app has access to a given GitHub repository.
 *
 * @param githubUrl - The URL of the GitHub repository to check
 * @returns true if the fern GitHub app has access to the repository, false otherwise
 */
export async function checkFernHasAccessToRepo(githubUrl: string) {
  const { owner, repo } = getOwnerAndRepoFromGithubUrl(githubUrl);
  if (owner == null || repo == null) {
    return false;
  }

  try {
    const fernBotOctokit = await getFernBotOctokitForRepo(owner, repo);
    if (fernBotOctokit == null) {
      return false;
    }
    return true;
  } catch (_error) {
    return false;
  }
}
