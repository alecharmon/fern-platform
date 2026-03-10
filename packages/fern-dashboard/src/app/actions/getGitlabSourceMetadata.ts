"use server";

import { unstable_cache } from "next/cache";

import { getCurrentSession } from "@/app/services/auth0/getCurrentSession";
import { parseGitUrl } from "@/app/services/git-common/url-utils";
import type { GitSourceRepo } from "@/app/services/github/types";
import { getGitlabToken } from "@/app/services/gitlab/gitlab-token";

const EMPTY_RESPONSE: GitSourceRepo = {
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
}): Promise<GitSourceRepo> {
    async function fetchGitlabSourceMetadata() {
        if (gitlabUrl == null) {
            throw new Error("NoGitlabUrl");
        }

        const parsed = parseGitUrl(gitlabUrl);
        const { owner, path } = parsed;

        // For GitLab, 'path' contains the full path (e.g., "team/subteam/my-repo")
        // Fall back to 'repo' for simple cases
        const fullPath = path ?? parsed.repo;

        if (owner == null || fullPath == null) {
            throw new Error("NoOwnerOrRepo");
        }

        // Get GitLab token for this owner/repo
        const token = await getGitlabToken(owner, fullPath);
        if (!token) {
            throw new Error("NoGitlabToken");
        }

        try {
            // Encode the full project path (owner/path) for GitLab API
            const projectPath = encodeURIComponent(`${owner}/${fullPath}`);

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

            const result = {
                gitUrl: gitlabUrl,
                repoName: data.path_with_namespace,
                // Use the owner from the parsed URL, not from namespace which may be a nested group
                owner: owner,
                // For GitLab, repo should contain the full path for API calls to work correctly
                repo: fullPath,
                baseBranch: data.default_branch ?? "main",
                fernBotHasInstallationId: false // GitLab doesn't use Fern bot
            };

            return result;
        } catch (error) {
            console.error("Failed to get GitLab repo info", error);
            throw new Error("FailedToGetRepoInfo");
        }
    }

    const session = await getCurrentSession();
    if (session == null) {
        console.error("[getGitlabSourceMetadata]", "Not authenticated");
        return EMPTY_RESPONSE;
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
