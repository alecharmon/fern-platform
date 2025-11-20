"use server";

import { unstable_cache } from "next/cache";
import { parseGitUrl } from "@/app/services/git-common/url-utils";
import type { GithubSourceRepo } from "@/app/services/github/types";
import { getGitlabToken } from "@/app/services/gitlab/gitlab-token";

const EMPTY_RESPONSE: GithubSourceRepo = {
    gitUrl: undefined,
    repoName: undefined,
    owner: undefined,
    repo: undefined,
    baseBranch: undefined,
    fernBotHasInstallationId: undefined
};

export async function getGitlabSourceMetadata({
    gitlabUrl,
    userId,
    skipCache = false
}: {
    gitlabUrl: string;
    userId: string;
    skipCache?: boolean;
}): Promise<GithubSourceRepo> {
    async function fetchGitlabSourceMetadata() {
        if (gitlabUrl == null) {
            throw new Error("NoGitlabUrl");
        }

        const parsed = parseGitUrl(gitlabUrl);
        const { owner, repo } = parsed;

        if (owner == null || repo == null) {
            throw new Error("NoOwnerOrRepo");
        }

        // Get GitLab token for this owner/repo
        const token = await getGitlabToken(owner, repo);
        if (!token) {
            throw new Error("NoGitlabToken");
        }

        try {
            // Encode the project path (owner/repo) for GitLab API
            const projectPath = encodeURIComponent(`${owner}/${repo}`);

            // Fetch project metadata from GitLab API
            const response = await fetch(`https://gitlab.com/api/v4/projects/${projectPath}`, {
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json"
                }
            });

            if (!response.ok) {
                throw new Error(`GitLab API error: ${response.status} ${response.statusText}`);
            }

            const data = await response.json();

            console.log(`[getGitlabSourceMetadata] GitLab API response:`, {
                path_with_namespace: data.path_with_namespace,
                default_branch: data.default_branch,
                namespace: data.namespace?.name
            });

            return {
                gitUrl: gitlabUrl,
                repoName: data.path_with_namespace,
                owner: data.namespace?.name ?? owner,
                repo: data.name ?? repo,
                baseBranch: data.default_branch ?? "main",
                fernBotHasInstallationId: false // GitLab doesn't use Fern bot
            };
        } catch (error) {
            console.error("Failed to get GitLab repo info", error);
            throw new Error("FailedToGetRepoInfo");
        }
    }

    try {
        const result = skipCache
            ? fetchGitlabSourceMetadata()
            : unstable_cache(fetchGitlabSourceMetadata, [`gitlab-source-${gitlabUrl}-${userId}`], {
                  revalidate: 300, // 5 minutes
                  tags: [`gitlab-source-${gitlabUrl}`]
              })();
        return await result;
    } catch (error) {
        console.error("[getGitlabSourceMetadata]", error);
        return EMPTY_RESPONSE;
    }
}
