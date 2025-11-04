"use server";

import { getDemoCreationBotOctokit } from "@/app/services/auth0/fernBotOctokit";
import { getCurrentSession } from "@/app/services/auth0/getCurrentSession";

import type { Auth0OrgName } from "../../auth0/types";

export type TransferGitRepositoryErrors =
    | { type: "NOT_LOGGED_IN" }
    | { type: "MISSING_TOKEN" }
    | { type: "FAILED_TO_TRANSFER_REPOSITORY"; message: string }
    | { type: "UNKNOWN_ERROR"; message: string };

export default async function transferGitRepository(request: {
    orgName: Auth0OrgName;
    currentOwner: string;
    repoName: string;
    newOwner: string;
}): Promise<
    | {
          success: true;
          newRepoUrl: string;
      }
    | {
          success: false;
          error: TransferGitRepositoryErrors;
      }
> {
    const session = await getCurrentSession();
    if (session == null) {
        return { success: false, error: { type: "NOT_LOGGED_IN" } };
    }

    // Get demo creation bot Octokit using personal access token
    const octokitResult = getDemoCreationBotOctokit();

    if (!octokitResult.ok) {
        console.error("Failed to get demo creation bot octokit:", octokitResult.error);
        return { success: false, error: octokitResult.error };
    }

    const octokit = octokitResult.octokit;

    try {
        // Transfer the repository to the new owner
        const transferResponse = await octokit.request("POST /repos/{owner}/{repo}/transfer", {
            owner: request.currentOwner,
            repo: request.repoName,
            new_owner: request.newOwner,
            headers: {
                "X-GitHub-Api-Version": "2022-11-28"
            }
        });

        const newRepoUrl = transferResponse.data.html_url;

        return {
            success: true,
            newRepoUrl
        };
    } catch (error: any) {
        console.error("Failed to transfer repository:", error);
        return {
            success: false,
            error: {
                type: "FAILED_TO_TRANSFER_REPOSITORY",
                message:
                    error instanceof Error
                        ? `${error.message}${error.response?.data?.message ? ` - ${error.response.data.message}` : ""}`
                        : "Unknown error occurred"
            }
        };
    }
}
