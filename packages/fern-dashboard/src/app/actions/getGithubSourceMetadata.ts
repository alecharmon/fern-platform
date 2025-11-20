"use server";

import { unstable_cache } from "next/cache";

import { getFernBotInstallationId, getFernBotOctokitForRepo } from "@/app/services/auth0/fernBotOctokit";
import { parseGitUrl } from "@/app/services/git-common/url-utils";
import { getOwnerAndRepoFromGithubUrl } from "@/app/services/github/github";
import type { GithubSourceRepo } from "@/app/services/github/types";

const EMPTY_RESPONSE: GithubSourceRepo = {
    gitUrl: undefined,
    repoName: undefined,
    owner: undefined,
    repo: undefined,
    baseBranch: undefined,
    fernBotHasInstallationId: undefined
};

export async function getGithubSourceMetadata({
    gitUrl,
    userId,
    skipCache = false
}: {
    gitUrl: string;
    userId: string;
    skipCache?: boolean;
}): Promise<GithubSourceRepo> {
    async function fetchGithubSourceMetadata() {
        if (gitUrl == null) {
            throw new Error("NoGithubUrl");
        }

        // Check if this is a GitHub URL - this function only works with GitHub
        const parsed = parseGitUrl(gitUrl);
        if (parsed.provider !== "github") {
            // For non-GitHub URLs (GitLab, etc.), return empty response
            // GitLab metadata will be handled by a separate function
            return EMPTY_RESPONSE;
        }

        const { owner, repo } = getOwnerAndRepoFromGithubUrl(gitUrl);

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
                repo
            });
            // check if fern-bot is installed on this app
            const installationResult = await getFernBotInstallationId(owner, repo);
            const fernBotHasInstallationId = installationResult.ok;

            return {
                gitUrl,
                repoName: response.data.full_name,
                owner: response.data.owner.name ?? owner,
                repo: response.data.name ?? repo,
                baseBranch: response.data.default_branch,
                fernBotHasInstallationId
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
            ? fetchGithubSourceMetadata()
            : unstable_cache(fetchGithubSourceMetadata, [`github-source-${gitUrl}-${userId}`], {
                  revalidate: 300, // 5 minutes
                  tags: [`github-source-${gitUrl}`]
              })();
        return await result;
    } catch (error) {
        console.error("[getGithubSourceMetadata]", error);
        // On any error, return EMPTY_RESPONSE (but don't cache the error)
        return EMPTY_RESPONSE;
    }
}
