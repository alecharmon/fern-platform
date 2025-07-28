import { unstable_cache } from "next/cache";

import { getOctokit } from "@/app/services/auth0/octokit";
import { Auth0UserID } from "@/app/services/auth0/types";
import { GithubSourceRepo } from "@/app/services/github/types";

import { getDocsUrlMetadata } from "../utils/getDocsUrlMetadata";

const EMPTY_RESPONSE: GithubSourceRepo = {
  githubUrl: undefined,
  repoName: undefined,
  owner: undefined,
  repo: undefined,
  baseBranch: undefined,
};

export default async function getDocsGithubSourceHandler({
  url,
  token,
  userId,
}: {
  url: string;
  token: string;
  userId: Auth0UserID;
}): Promise<GithubSourceRepo> {
  // Only cache successful responses; do not cache failures
  return unstable_cache(
    async () => {
      const docsUrlMetadata = await getDocsUrlMetadata({
        url: decodeURIComponent(url),
        token,
      });
      if (!docsUrlMetadata.ok) {
        // the docs url is user-supplied (parsed from the page url) so it's ok if it
        // doesn't exist
        if (docsUrlMetadata.error.error === "DomainNotRegisteredError") {
          // Don't cache this failure, so throw to skip cache
          throw new Error("DomainNotRegisteredError");
        }

        console.error(
          "Failed to load docs URL metadata",
          JSON.stringify(docsUrlMetadata.error)
        );
        throw new Error(
          `Unable to find that domain. Please check that the domain "${decodeURIComponent(
            url
          )}" is correct.`
        );
      }

      if (docsUrlMetadata.body.gitUrl == null) {
        // Don't cache this failure, so throw to skip cache
        throw new Error("NoGitUrl");
      }

      const octokit = await getOctokit(userId);
      if (octokit == null) {
        // Don't cache this failure, so throw to skip cache
        throw new Error("NoOctokit");
      }

      const [owner, repo] = docsUrlMetadata.body.gitUrl.split("/").slice(-2);
      if (owner == null || repo == null) {
        // Don't cache this failure, so throw to skip cache
        throw new Error("InvalidGitUrl");
      }

      try {
        const response = await octokit.request("GET /repos/{owner}/{repo}", {
          owner,
          repo,
        });
        return {
          githubUrl: docsUrlMetadata.body.gitUrl,
          repoName: response.data.full_name,
          owner: response.data.owner.name ?? owner,
          repo: response.data.name ?? repo,
          baseBranch: response.data.default_branch,
        };
      } catch (error) {
        console.error("Failed to get repo info", error);
        // Don't cache this failure, so throw to skip cache
        throw new Error("FailedToGetRepoInfo");
      }
    },
    [`github-source-${url}-${userId}`],
    {
      revalidate: 300, // 5 minutes
      tags: [`github-source-${url}`],
    }
  )().catch(() => {
    // On any error, return EMPTY_RESPONSE (but don't cache the error)
    return EMPTY_RESPONSE;
  });
}
