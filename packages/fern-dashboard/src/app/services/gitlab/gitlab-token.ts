import "server-only";

import { get as getEdge } from "@vercel/edge-config";

type GitLabConfigStructure = Record<string, { token: string }>;

export async function getGitlabToken(owner: string, repo: string): Promise<string | null> {
    try {
        console.log(`[getGitlabToken] Looking up token for owner: ${owner}, repo: ${repo}`);
        const config = await getEdge<GitLabConfigStructure>("gitlab_config");

        if (!config || typeof config !== "object") {
            console.error(`[getGitlabToken] gitlab_config not found in Edge Config for ${owner}/${repo}`);
            return null;
        }

        console.log(`[getGitlabToken] Edge Config keys available:`, Object.keys(config));

        if (config[owner]?.token) {
            console.log(`[getGitlabToken] Token found for owner: ${owner}`);
            return config[owner].token;
        }

        console.error(`[getGitlabToken] No GitLab token found for owner: ${owner}, repo: ${repo}`);
        console.error(`[getGitlabToken] Available owners in config:`, Object.keys(config));
        return null;
    } catch (error) {
        console.error(`[getGitlabToken] Failed to get GitLab token for ${owner}/${repo}:`, error);
        return null;
    }
}
