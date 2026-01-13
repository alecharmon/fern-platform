"use server";

import { unstable_cache } from "next/cache";

import {
    getFernBotInstallationId,
    getFernBotOctokitForRepo,
    getGheOctokitForRepo
} from "@/app/services/auth0/fernBotOctokit";
import { parseGitUrl } from "@/app/services/git-common/url-utils";
import { isGheUrl } from "@/app/services/github/ghe-config";
import type { GitSourceRepo } from "@/app/services/github/types";

const EMPTY_RESPONSE: GitSourceRepo = {
    gitUrl: undefined,
    repoName: undefined,
    owner: undefined,
    repo: undefined,
    baseBranch: undefined,
    fernBotHasInstallationId: undefined
};

export async function getGithubSourceMetadata({
    githubUrl,
    userId,
    skipCache = false
}: {
    githubUrl: string;
    userId: string;
    skipCache?: boolean;
}): Promise<GitSourceRepo> {
    async function fetchGithubSourceMetadata() {
        if (githubUrl == null) {
            throw new Error("NoGithubUrl");
        }

        // Check if this is a GitHub URL - this function only works with GitHub
        // Note: parseGitUrl handles both github.com and GHE URLs (e.g., github.mycompany.com)
        const parsed = parseGitUrl(githubUrl);
        if (parsed.provider !== "github") {
            // For non-GitHub URLs (GitLab, etc.), return empty response
            // GitLab metadata will be handled by a separate function
            return EMPTY_RESPONSE;
        }

        // Use parsed result which handles both github.com and GHE URLs
        const { owner, repo } = parsed;

        if (owner == null || repo == null) {
            // Don't cache this failure, so throw to skip cache
            throw new Error("NoOwnerOrRepo");
        }

        // Check if this is a GitHub Enterprise URL
        const isGhe = await isGheUrl(githubUrl);

        // Get the appropriate Octokit instance
        const octokitResult = isGhe
            ? await getGheOctokitForRepo(githubUrl, owner, repo)
            : await getFernBotOctokitForRepo(owner, repo);

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

            // For GHE, we don't check fern-bot installation (they use their own GHE app)
            // For github.com, check if fern-bot is installed
            let fernBotHasInstallationId: boolean | undefined;
            if (!isGhe) {
                const installationResult = await getFernBotInstallationId(owner, repo);
                fernBotHasInstallationId = installationResult.ok;
            } else {
                // For GHE, we consider the "installation" valid if we got an Octokit
                fernBotHasInstallationId = true;
            }

            return {
                gitUrl: githubUrl,
                repoName: response.data.full_name,
                owner: response.data.owner.name ?? owner,
                repo: repo,
                baseBranch: response.data.default_branch,
                fernBotHasInstallationId
            } as GitSourceRepo;
        } catch (error) {
            console.error("Failed to get repo info", error);
            // Don't cache this failure, so throw to skip cache
            throw new Error("FailedToGetRepoInfo");
        }
    }
    try {
        // Only cache successful responses; do not cache failures
        const result: Promise<GitSourceRepo> = skipCache
            ? fetchGithubSourceMetadata()
            : unstable_cache(fetchGithubSourceMetadata, [`github-source-${githubUrl}-${userId}`], {
                  revalidate: 300, // 5 minutes
                  tags: [`github-source-${githubUrl}`]
              })();
        return await result;
    } catch (error) {
        console.error("[getGithubSourceMetadata]", error);
        // On any error, return EMPTY_RESPONSE (but don't cache the error)
        return EMPTY_RESPONSE;
    }
}
