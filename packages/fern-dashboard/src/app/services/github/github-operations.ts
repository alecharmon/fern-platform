import "server-only";

import type { Octokit } from "@octokit/core";

/**
 * Raw (uncached) GitHub API operations.
 * Each function takes an Octokit instance and returns data directly.
 * Caching is handled by the caller (see github-loader.ts).
 */

export async function fetchCommitRef(octokit: Octokit, owner: string, repo: string, ref: string): Promise<string> {
    const response = await octokit.request("GET /repos/{owner}/{repo}/commits/{ref}", { owner, repo, ref });
    return response.data.sha;
}

export async function fetchFileContent(
    octokit: Octokit,
    owner: string,
    repo: string,
    commitSha: string,
    path: string
): Promise<string> {
    const response = await octokit.request("GET /repos/{owner}/{repo}/contents/{path}", {
        owner,
        repo,
        path,
        ref: commitSha,
        headers: { accept: "application/vnd.github.v3.raw" }
    });
    return response.data as unknown as string;
}

export async function fetchRepository(octokit: Octokit, owner: string, repo: string) {
    try {
        const repositoryResponse = await octokit.request("GET /repos/{owner}/{repo}", { owner, repo });
        return repositoryResponse;
    } catch (error: any) {
        console.error("Failed to get repository", error);
        if (error?.status === 404) {
            return null;
        }
        throw error;
    }
}

export async function fetchTree(octokit: Octokit, owner: string, repo: string, treeSha: string) {
    const treeResponse = await octokit.request("GET /repos/{owner}/{repo}/git/trees/{tree_sha}", {
        owner,
        repo,
        tree_sha: treeSha,
        recursive: "true"
    });
    return treeResponse;
}
