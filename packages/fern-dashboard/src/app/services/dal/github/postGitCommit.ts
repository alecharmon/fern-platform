"use server";

import * as Sentry from "@sentry/nextjs";
import { type FernBotOctokitError, getFernBotOctokitForRepo } from "@/app/services/auth0/fernBotOctokit";
import { getCurrentSession } from "@/app/services/auth0/getCurrentSession";
import type { GITHUB_FILE_MODE, GithubCommitableFile } from "@/app/services/github/types";
import type { Auth0OrgName } from "../../auth0/types";
import { type AuthError, withGithubAuth } from "./middleware";

export type PostGitCommitErrors =
    | AuthError
    | FernBotOctokitError
    | { type: "NOT_LOGGED_IN" }
    | { type: "FAILED_TO_GET_GITHUB_CLIENT"; message: string }
    | { type: "FAILED_TO_GET_BRANCH_SHA"; message: string }
    | { type: "FAILED_TO_GET_LATEST_COMMIT_SHA"; message: string }
    | { type: "FAILED_TO_CREATE_TREE"; message: string }
    | { type: "FAILED_TO_CREATE_COMMIT"; message: string }
    | { type: "FAILED_TO_GET_FILE_TREE"; message: string }
    | { type: "FAILED_TO_POST_COMMIT"; message: string }
    | { type: "FAILED_TO_UPDATE_BRANCH_REF"; message: string }
    | { type: "UNKNOWN_ERROR"; message: string };

export default async function postGitCommit(request: {
    owner: string;
    repo: string;
    branch: string;
    message: string;
    orgName: Auth0OrgName;
    files: GithubCommitableFile[];
    site: string;
}): Promise<
    | {
          success: true;
          commitSha?: string;
      }
    | {
          success: false;
          error: PostGitCommitErrors;
      }
> {
    const session = await getCurrentSession();
    if (session == null) {
        return { success: false, error: { type: "NOT_LOGGED_IN" } };
    }

    return withGithubAuth(
        session.user.sub,
        session.accessToken,
        request.orgName,
        {
            owner: request.owner,
            repo: request.repo,
            site: request.site
        },
        async (authResult) => {
            if (!authResult.ok) {
                return { success: false, error: authResult.error };
            }

            const octokitResult = await getFernBotOctokitForRepo(request.owner, request.repo);

            if (!octokitResult.ok) {
                return { success: false, error: octokitResult.error };
            }

            const octokit = octokitResult.octokit;

            try {
                let baseSha: string;
                try {
                    // Get the current tree SHA for the branch
                    const refResponse = await octokit.request("GET /repos/{owner}/{repo}/git/ref/{ref}", {
                        owner: request.owner,
                        repo: request.repo,
                        ref: `heads/${request.branch}`
                    });

                    if (!refResponse.data.object?.sha) {
                        throw new Error("Retrieved branch SHA is null");
                    }
                    baseSha = refResponse.data.object.sha;
                } catch (error) {
                    return {
                        success: false,
                        error: {
                            type: "FAILED_TO_GET_BRANCH_SHA",
                            message: error instanceof Error ? error.message : "Unknown error occurred"
                        }
                    };
                }

                let baseTreeSha: string;

                try {
                    // Get the current commit to get the tree SHA
                    const commitResponse = await octokit.request("GET /repos/{owner}/{repo}/git/commits/{commit_sha}", {
                        owner: request.owner,
                        repo: request.repo,
                        commit_sha: baseSha
                    });

                    if (!commitResponse.data.tree?.sha) {
                        throw new Error("Retrieved tree SHA is null");
                    }
                    baseTreeSha = commitResponse.data.tree.sha;
                } catch (error) {
                    return {
                        success: false,
                        error: {
                            type: "FAILED_TO_GET_LATEST_COMMIT_SHA",
                            message: error instanceof Error ? error.message : "Unknown error occurred"
                        }
                    };
                }

                // If there are files to delete, we need to get the existing files in the base tree so we can validate deletions
                const hasFilesToDelete = request.files.some((file) => file.delete);
                let existingFiles: Set<string> = new Set();

                if (hasFilesToDelete) {
                    // Get the base tree to check which files actually exist
                    let baseTreeResponse;
                    try {
                        baseTreeResponse = await octokit.request("GET /repos/{owner}/{repo}/git/trees/{tree_sha}", {
                            owner: request.owner,
                            repo: request.repo,
                            tree_sha: baseTreeSha,
                            recursive: "true" // Get all files recursively
                        });
                        if (!baseTreeResponse.data.tree) {
                            throw new Error("Retrieved file tree is null");
                        }
                    } catch (error) {
                        return {
                            success: false,
                            error: {
                                type: "FAILED_TO_GET_FILE_TREE",
                                message: error instanceof Error ? error.message : "Unknown error occurred"
                            }
                        };
                    }
                    // Create a set of existing file paths for quick lookup
                    existingFiles = new Set(
                        baseTreeResponse.data.tree.filter((item) => item.type === "blob").map((item) => item.path) || []
                    );
                }

                // Create a new tree with the files
                const tree = request.files
                    .map((file) => {
                        if (file.delete) {
                            // Only include deletion entries for files that actually exist in the base tree
                            if (!existingFiles.has(file.path)) {
                                Sentry.captureException(
                                    new Error(
                                        `File ${file.path} does not exist in the base tree, but was requested to be deleted.`
                                    ),
                                    {
                                        extra: {
                                            owner: request.owner,
                                            repo: request.repo,
                                            branch: request.branch
                                        }
                                    }
                                );
                                return null;
                            }
                            // For deletions of existing files, GitHub still requires mode and type
                            return {
                                path: file.path,
                                mode: (file.mode || "100644") as GITHUB_FILE_MODE,
                                type: "blob" as const,
                                sha: null
                            };
                        } else {
                            // Validate file content exists
                            if (file.content == null) {
                                throw new Error(`File ${file.path} has no content`);
                            }

                            return {
                                path: file.path,
                                mode: (file.mode || "100644") as GITHUB_FILE_MODE,
                                type: "blob" as const,
                                content: file.content
                            };
                        }
                    })
                    .filter((item) => item != null); // Remove null entries

                let newTreeSha: string;
                try {
                    const treeResponse = await octokit.request("POST /repos/{owner}/{repo}/git/trees", {
                        owner: request.owner,
                        repo: request.repo,
                        base_tree: baseTreeSha,
                        tree
                    });
                    newTreeSha = treeResponse.data.sha;
                    if (!newTreeSha) {
                        throw new Error("Retrieved tree SHA is null");
                    }
                } catch (error) {
                    return {
                        success: false,
                        error: {
                            type: "FAILED_TO_CREATE_TREE",
                            message: error instanceof Error ? error.message : "Unknown error occurred"
                        }
                    };
                }

                let commitSha: string;
                try {
                    // Create a new commit
                    const response = await octokit.request("POST /repos/{owner}/{repo}/git/commits", {
                        owner: request.owner,
                        repo: request.repo,
                        message: request.message,
                        tree: newTreeSha,
                        parents: [baseSha]
                    });
                    commitSha = response.data.sha;
                    if (!commitSha) {
                        throw new Error("Retrieved commit SHA is null");
                    }
                } catch (error) {
                    return {
                        success: false,
                        error: {
                            type: "FAILED_TO_POST_COMMIT",
                            message: error instanceof Error ? error.message : "Unknown error occurred"
                        }
                    };
                }
                try {
                    // Update the branch reference to point to the new commit
                    await octokit.request("PATCH /repos/{owner}/{repo}/git/refs/{ref}", {
                        owner: request.owner,
                        repo: request.repo,
                        ref: `heads/${request.branch}`,
                        sha: commitSha
                    });

                    return {
                        success: true,
                        commitSha
                    };
                } catch (error) {
                    return {
                        success: false,
                        error: {
                            type: "FAILED_TO_UPDATE_BRANCH_REF",
                            message: error instanceof Error ? error.message : "Unknown error occurred"
                        }
                    };
                }
            } catch (error) {
                console.error("Failed to commit changes", error);
                return {
                    success: false,
                    error: {
                        type: "UNKNOWN_ERROR",
                        message: error instanceof Error ? error.message : "Unknown error occurred"
                    }
                };
            }
        }
    );
}
