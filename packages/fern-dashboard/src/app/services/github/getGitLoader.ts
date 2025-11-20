import "server-only";

import type { GitLoader } from "@fern-api/docs-loader";
import { type GitHubAuthMode, GitHubLoader } from "./github-loader";

/**
 * Factory function to get the appropriate GitLoader based on the repository URL.
 * Currently supports GitHub, with future support for GitLab and other providers.
 *
 * @param repoUrl - The repository URL (e.g., "https://github.com/owner/repo")
 * @param demo - Whether to use demo/onboarding bot credentials instead of regular bot
 * @returns The appropriate GitLoader implementation
 */
export function getGitLoader(repoUrl: string, demo?: boolean): GitLoader {
    const url = repoUrl.toLowerCase();

    // Determine which provider based on URL
    if (url.includes("github.com")) {
        const authMode: GitHubAuthMode = demo ? "demo-creation-bot" : "fern-bot";
        return new GitHubLoader({ githubUrl: repoUrl }, authMode);
    }

    // Future: GitLab support
    // if (url.includes("gitlab.com")) {
    //     return new GitLabLoader({ gitlabUrl: repoUrl }, demo ? "demo" : "production");
    // }

    // Default to GitHub for now (most common case)
    const authMode: GitHubAuthMode = demo ? "demo-creation-bot" : "fern-bot";
    return new GitHubLoader({ githubUrl: repoUrl }, authMode);
}

/**
 * Factory function to get the appropriate GitLoader based on owner/repo.
 * Assumes GitHub as the provider.
 *
 * @param owner - The repository owner
 * @param repo - The repository name
 * @param demo - Whether to use demo/onboarding bot credentials instead of regular bot
 * @returns The appropriate GitLoader implementation
 */
export function getGitLoaderByOwnerRepo(owner: string, repo: string, demo?: boolean): GitLoader {
    const authMode: GitHubAuthMode = demo ? "demo-creation-bot" : "fern-bot";
    return new GitHubLoader({ owner, repo }, authMode);
}
