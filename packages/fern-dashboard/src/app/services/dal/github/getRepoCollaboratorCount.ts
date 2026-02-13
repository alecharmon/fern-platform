import "server-only";

import { cache } from "react";
import { getDemoCreationBotOctokit } from "@/app/services/auth0/fernBotOctokit";

const FERN_OWNED_ACCOUNTS = ["fern-support", "fern", "fern-demo"];

interface GetRepoCollaboratorCountSuccess {
    success: true;
    count: number;
}

interface GetRepoCollaboratorCountError {
    success: false;
}

export type GetRepoCollaboratorCountResult = GetRepoCollaboratorCountSuccess | GetRepoCollaboratorCountError;

export const getRepoCollaboratorCount = cache(
    async (owner: string, repoName: string): Promise<GetRepoCollaboratorCountResult> => {
        if (!FERN_OWNED_ACCOUNTS.includes(owner)) {
            return { success: false };
        }

        const demoCreationBotOwner = process.env.FERN_DEMO_CREATION_BOT_OWNER;
        if (!demoCreationBotOwner) {
            return { success: false };
        }

        const octokitResult = getDemoCreationBotOctokit();
        if (!octokitResult.ok) {
            return { success: false };
        }

        try {
            const [collaboratorsResponse, invitationsResponse] = await Promise.all([
                octokitResult.octokit.request("GET /repos/{owner}/{repo}/collaborators", {
                    owner: demoCreationBotOwner,
                    repo: repoName,
                    per_page: 100
                }),
                octokitResult.octokit.request("GET /repos/{owner}/{repo}/invitations", {
                    owner: demoCreationBotOwner,
                    repo: repoName,
                    per_page: 100
                })
            ]);

            const collaborators = collaboratorsResponse.data as Array<{ login: string }>;
            const invitations = invitationsResponse.data as Array<{ id: number }>;

            const externalCollaborators = collaborators.filter(
                (c) => c.login.toLowerCase() !== demoCreationBotOwner.toLowerCase()
            );

            return {
                success: true,
                count: externalCollaborators.length + invitations.length
            };
        } catch (error) {
            console.error("[getRepoCollaboratorCount] Failed to fetch collaborator count:", error);
            return { success: false };
        }
    }
);
