"use server";

import { getDemoCreationBotOctokit } from "@/app/services/auth0/fernBotOctokit";

export type CheckGitRepositoryErrors =
    | { type: "NOT_LOGGED_IN" }
    | { type: "MISSING_TOKEN" }
    | { type: "UNKNOWN_ERROR"; message: string };

/**
 * Checks if a GitHub repository exists for a given docs site URL by listing all repos
 * from the bot account and checking if ours is present
 */
export default async function checkGitRepository(request: { docsSiteUrl: string }): Promise<
    | {
          success: true;
          exists: true;
          repoUrl: string;
          owner: string;
          repoName: string;
      }
    | {
          success: true;
          exists: false;
      }
    | {
          success: false;
          error: CheckGitRepositoryErrors;
      }
> {
    // Get demo creation bot Octokit (uses FERN_DEMO_CREATION_BOT_TOKEN)
    // This checks the bot account's repos, not the current user's repos
    const octokitResult = getDemoCreationBotOctokit();
    if (!octokitResult.ok) {
        return { success: false, error: octokitResult.error };
    }

    const octokit = octokitResult.octokit;

    // Generate the repo name from the docs site URL (same logic as onboarding handler)
    const expectedRepoName = request.docsSiteUrl.replace(/[^a-zA-Z0-9-]/g, "-").toLowerCase();

    // Get the owner from environment variable
    const demoCreationBotOwner = process.env.FERN_DEMO_CREATION_BOT_OWNER;
    if (!demoCreationBotOwner) {
        return {
            success: false,
            error: {
                type: "UNKNOWN_ERROR",
                message: "GitHub repository owner not configured"
            }
        };
    }

    try {
        // Paginate through all repositories for the authenticated bot user
        // Use GET /user/repos (authenticated) instead of GET /users/{username}/repos (public only)
        // This is required to see private repositories
        // We paginate through all pages until we find our repo or exhaust all pages
        let page = 1;
        const perPage = 100;

        while (true) {
            const response = await octokit.request("GET /user/repos", {
                per_page: perPage,
                page,
                type: "owner", // Only repos owned by the authenticated user
                sort: "created",
                direction: "desc" // Most recent first
            });

            const repos = response.data;

            // Check if our expected repo name is in this page
            const matchingRepo = repos.find((repo) => repo.name === expectedRepoName);

            if (matchingRepo) {
                return {
                    success: true,
                    exists: true,
                    repoUrl: matchingRepo.html_url,
                    owner: matchingRepo.owner.login,
                    repoName: matchingRepo.name
                };
            }

            // If we got fewer repos than perPage, we've reached the last page
            if (repos.length < perPage) {
                break;
            }

            page++;
        }

        // Repo not found after checking all pages
        return {
            success: true,
            exists: false
        };
    } catch (error: any) {
        console.error("Error checking GitHub repository:", error);
        return {
            success: false,
            error: {
                type: "UNKNOWN_ERROR",
                message: error instanceof Error ? error.message : "Unknown error occurred"
            }
        };
    }
}
