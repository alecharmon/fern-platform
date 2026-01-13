import "server-only";

import type { GitLoader } from "@fern-api/docs-loader";

import { type GitLabAuthMode, GitLabLoader } from "../gitlab";
import { isGheUrl } from "./ghe-config";
import { type GitHubAuthMode, GitHubLoader } from "./github-loader";

/**
 * Factory function to get the appropriate GitLoader based on the repository URL.
 * Supports GitHub, GitHub Enterprise, and GitLab providers.
 *
 * @param repoUrl - The repository URL (e.g., "https://github.com/owner/repo" or "https://gitlab.com/owner/repo")
 * @param demo - Whether to use demo/onboarding bot credentials instead of regular bot
 * @returns The appropriate GitLoader implementation
 */
export async function getGitLoader(repoUrl: string, demo?: boolean): Promise<GitLoader> {
    const url = repoUrl.toLowerCase();

    // Determine which provider based on URL
    if (url.includes("gitlab")) {
        const authMode: GitLabAuthMode = demo ? "demo" : "production";
        return new GitLabLoader({ gitlabUrl: repoUrl }, authMode);
    }

    // Check if this is a GitHub Enterprise URL
    const isGhe = await isGheUrl(repoUrl);

    if (isGhe) {
        // GHE doesn't support demo mode - always use ghe auth
        return new GitHubLoader({ githubUrl: repoUrl }, "ghe");
    }

    if (url.includes("github.com")) {
        const authMode: GitHubAuthMode = demo ? "demo-creation-bot" : "fern-bot";
        return new GitHubLoader({ githubUrl: repoUrl }, authMode);
    }

    // Default to GitHub (most common case)
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
