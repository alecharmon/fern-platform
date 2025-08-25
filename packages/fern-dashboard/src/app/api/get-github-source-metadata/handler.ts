import { unstable_cache } from "next/cache";

import {
  getFernBotInstallationId,
  getFernBotOctokitForRepo,
} from "@/app/services/auth0/fernBotOctokit";
import { getOwnerAndRepoFromGithubUrl } from "@/app/services/github/github";
import { GithubSourceRepo } from "@/app/services/github/types";

const EMPTY_RESPONSE: GithubSourceRepo = {
  githubUrl: undefined,
  repoName: undefined,
  owner: undefined,
  repo: undefined,
  baseBranch: undefined,
  fernBotHasInstallationId: undefined,
};

export default async function getGithubSourceMetadataHandler({
  githubUrl,
  userId,
  skipCache = false,
}: {
  githubUrl: string;
  userId: string;
  skipCache?: boolean;
}): Promise<GithubSourceRepo> {
  async function getGithubSourceMetadata() {
    if (githubUrl == null) {
      throw new Error("NoGithubUrl");
    }

    const { owner, repo } = getOwnerAndRepoFromGithubUrl(githubUrl);

    if (owner == null || repo == null) {
      // Don't cache this failure, so throw to skip cache
      throw new Error("NoOwnerOrRepo");
    }

    const octokitResult = await getFernBotOctokitForRepo(owner, repo);
    if (!octokitResult.ok) {
      // Don't cache this failure, so throw to skip cache
      throw new Error(`NoOctokit: ${octokitResult.error.type}`);
    }
    const octokit = octokitResult.octokit;

    try {
      const response = await octokit.request("GET /repos/{owner}/{repo}", {
        owner,
        repo,
      });
      // check if fern-bot is installed on this app
      const installationResult = await getFernBotInstallationId(owner, repo);
      const fernBotHasInstallationId = installationResult.ok;

      return {
        githubUrl,
        repoName: response.data.full_name,
        owner: response.data.owner.name ?? owner,
        repo: response.data.name ?? repo,
        baseBranch: response.data.default_branch,
        fernBotHasInstallationId,
      };
    } catch (error) {
      console.error("Failed to get repo info", error);
      // Don't cache this failure, so throw to skip cache
      throw new Error("FailedToGetRepoInfo");
    }
  }
  try {
    // Only cache successful responses; do not cache failures
    const result = skipCache
      ? getGithubSourceMetadata()
      : unstable_cache(
          getGithubSourceMetadata,
          [`github-source-${githubUrl}-${userId}`],
          {
            revalidate: 300, // 5 minutes
            tags: [`github-source-${githubUrl}`],
          }
        )();
    return await result;
  } catch (error) {
    console.error("[getDocsGithubSourceHandler]", error);
    // On any error, return EMPTY_RESPONSE (but don't cache the error)
    return EMPTY_RESPONSE;
  }
}
