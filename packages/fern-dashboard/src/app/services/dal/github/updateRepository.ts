"use server";

import type { RepositoryFile } from "@fern-api/docs-loader";

import { getGitLoaderByOwnerRepo } from "@/app/services/github/getGitLoader";

export interface UpdateRepositoryRequest {
    owner: string;
    repoName: string;
    files: RepositoryFile[];
    message?: string;
}

export type UpdateRepositoryResult = { success: true; commitSha: string } | { success: false; error: string };

/**
 * Updates files in an existing GitHub repository by creating a commit on the main branch.
 * This is used to update pre-created repos with full content after user completes setup.
 */
export async function updateRepository(request: UpdateRepositoryRequest): Promise<UpdateRepositoryResult> {
    const { owner, repoName, files, message = "Add documentation content" } = request;

    try {
        // Get GitLoader with demo bot credentials
        const loader = getGitLoaderByOwnerRepo(owner, repoName, true);

        // Check if createCommit is available
        if (!loader.createCommit) {
            return {
                success: false,
                error: "createCommit method not available on loader"
            };
        }

        // Create a commit with the new files on main branch
        const result = await loader.createCommit({
            owner,
            repo: repoName,
            branch: "main",
            message,
            files: files.map((file) => ({
                path: file.path,
                content: file.content,
                encoding: file.encoding
            }))
        });

        if (result.type === "ok") {
            return { success: true, commitSha: result.commitSha };
        } else {
            return {
                success: false,
                error: result.error.message || "Failed to update repository"
            };
        }
    } catch (error) {
        console.error("[updateRepository] Error:", error);
        return {
            success: false,
            error: error instanceof Error ? error.message : "Unknown error"
        };
    }
}
