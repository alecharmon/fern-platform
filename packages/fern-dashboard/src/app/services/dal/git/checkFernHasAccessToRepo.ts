import "server-only";

import { getFernBotOctokitForRepo } from "@/app/services/auth0/fernBotOctokit";
import { getOwnerAndRepoFromGithubUrl } from "@/app/services/github/github";

/**
 * Checks if the fern GitHub app has access to a given GitHub repository.
 *
 * @param gitUrl - The URL of the GitHub repository to check
 * @returns true if the fern GitHub app has access to the repository, false otherwise
 */
export async function checkFernHasAccessToRepo(gitUrl: string) {
    const { owner, repo } = getOwnerAndRepoFromGithubUrl(gitUrl);
    if (owner == null || repo == null) {
        return false;
    }

    const fernBotResult = await getFernBotOctokitForRepo(owner, repo);
    return fernBotResult.ok;
}
