"use server";

import { getDemoCreationBotOctokit } from "@/app/services/auth0/fernBotOctokit";
import { getCurrentSession } from "@/app/services/auth0/getCurrentSession";
import type { GITHUB_FILE_MODE } from "@/app/services/github/types";

import type { Auth0OrgName } from "../../auth0/types";

export type PostGitRepositoryErrors =
    | { type: "NOT_LOGGED_IN" }
    | { type: "MISSING_TOKEN" }
    | { type: "FAILED_TO_GET_GITHUB_CLIENT"; message: string }
    | { type: "FAILED_TO_CREATE_REPOSITORY"; message: string }
    | { type: "FAILED_TO_CREATE_TREE"; message: string }
    | { type: "FAILED_TO_CREATE_COMMIT"; message: string }
    | { type: "FAILED_TO_CREATE_BRANCH"; message: string }
    | { type: "UNKNOWN_ERROR"; message: string };

export interface RepositoryFile {
    path: string;
    content: string;
    mode?: GITHUB_FILE_MODE;
}

export default async function postGitRepository(request: {
    orgName: Auth0OrgName;
    owner: string;
    repoName: string;
    description?: string;
    isPrivate?: boolean;
    files: RepositoryFile[];
    site: string;
}): Promise<
    | {
          success: true;
          repoUrl: string;
          htmlUrl: string;
      }
    | {
          success: false;
          error: PostGitRepositoryErrors;
      }
> {
    const session = await getCurrentSession();
    if (session == null) {
        return { success: false, error: { type: "NOT_LOGGED_IN" } };
    }

    // Get demo creation bot Octokit using personal access token
    // This is simpler than GitHub App auth and just requires a PAT with repo creation permissions
    const octokitResult = getDemoCreationBotOctokit();

    if (!octokitResult.ok) {
        console.error("Failed to get demo creation bot octokit:", octokitResult.error);
        return { success: false, error: octokitResult.error };
    }

    const octokit = octokitResult.octokit;

    try {
        // Create the repository
        let repoUrl: string;
        let htmlUrl: string;
        try {
            // First, check if the owner is a user or organization
            let ownerType: "user" | "org";
            try {
                const ownerResponse = await octokit.request("GET /users/{username}", {
                    username: request.owner
                });
                ownerType = ownerResponse.data.type === "Organization" ? "org" : "user";
            } catch (error) {
                console.warn("Failed to determine owner type, assuming user:", error);
                ownerType = "user";
            }

            // Use the appropriate endpoint based on owner type
            let createRepoResponse;
            if (ownerType === "org") {
                // Create in organization
                createRepoResponse = await octokit.request("POST /orgs/{org}/repos", {
                    org: request.owner,
                    name: request.repoName,
                    description: request.description || "Fern documentation",
                    //   private: request.isPrivate ?? true,
                    private: request.isPrivate ?? true,
                    auto_init: true // Initialize with README to avoid "empty repo" error
                });
            } else {
                // Create in user account
                createRepoResponse = await octokit.request("POST /user/repos", {
                    name: request.repoName,
                    description: request.description || "Fern documentation",
                    private: request.isPrivate ?? true,
                    auto_init: true // Initialize with README to avoid "empty repo" error
                });
            }

            repoUrl = createRepoResponse.data.clone_url;
            htmlUrl = createRepoResponse.data.html_url;

            if (!repoUrl || !htmlUrl) {
                throw new Error("Failed to get repository URLs from response");
            }
        } catch (error) {
            return {
                success: false,
                error: {
                    type: "FAILED_TO_CREATE_REPOSITORY",
                    message: error instanceof Error ? error.message : "Unknown error occurred"
                }
            };
        }

        // Get the initial commit (created by auto_init) so we can create a tree based on it
        // GitHub takes a few seconds to initialize the repo, so we need to retry
        let baseTreeSha: string | undefined;
        let retries = 10;
        while (retries > 0) {
            try {
                await new Promise((resolve) => setTimeout(resolve, 1000)); // Wait 1 second between retries

                const mainBranchResponse = await octokit.request("GET /repos/{owner}/{repo}/git/refs/{ref}", {
                    owner: request.owner,
                    repo: request.repoName,
                    ref: "heads/main"
                });
                const mainCommitSha = mainBranchResponse.data.object.sha;

                const commitResponse = await octokit.request("GET /repos/{owner}/{repo}/git/commits/{commit_sha}", {
                    owner: request.owner,
                    repo: request.repoName,
                    commit_sha: mainCommitSha
                });
                baseTreeSha = commitResponse.data.tree.sha;
                break; // Success! Exit the retry loop
            } catch (error) {
                retries--;
                if (retries === 0) {
                    console.error("Failed to get base tree after all retries:", error);
                    throw new Error(
                        "Repository initialization timeout - GitHub took too long to initialize the repository"
                    );
                }
                console.log(`Waiting for repo to initialize... (${retries} retries left)`);
            }
        }

        // Create tree with all files
        const tree = request.files.map((file) => ({
            path: file.path,
            mode: (file.mode || "100644") as GITHUB_FILE_MODE,
            type: "blob" as const,
            content: file.content
        }));

        console.log(`Creating tree with ${tree.length} files`);

        let treeSha: string;
        try {
            const treeResponse = await octokit.request("POST /repos/{owner}/{repo}/git/trees", {
                owner: request.owner,
                repo: request.repoName,
                tree,
                base_tree: baseTreeSha // Base on the initial commit's tree
            });
            treeSha = treeResponse.data.sha;

            if (!treeSha) {
                throw new Error("Retrieved tree SHA is null");
            }
        } catch (error: any) {
            console.error("Failed to create tree:", error);
            console.error("Tree data:", JSON.stringify(tree.slice(0, 3), null, 2)); // Log first 3 files
            return {
                success: false,
                error: {
                    type: "FAILED_TO_CREATE_TREE",
                    message:
                        error instanceof Error
                            ? `${error.message}${error.response?.data?.message ? ` - ${error.response.data.message}` : ""}`
                            : "Unknown error occurred"
                }
            };
        }

        // Create commit (with parent commit if we have one)
        let commitSha: string;
        let parentCommitSha: string | undefined;

        // Get the current main branch commit to use as parent
        try {
            const mainBranchResponse = await octokit.request("GET /repos/{owner}/{repo}/git/refs/{ref}", {
                owner: request.owner,
                repo: request.repoName,
                ref: "heads/main"
            });
            parentCommitSha = mainBranchResponse.data.object.sha;
        } catch (_error) {
            console.warn("No parent commit found, creating initial commit");
        }

        try {
            const commitResponse = await octokit.request("POST /repos/{owner}/{repo}/git/commits", {
                owner: request.owner,
                repo: request.repoName,
                message: "Add Fern documentation",
                tree: treeSha,
                parents: parentCommitSha ? [parentCommitSha] : [] // Link to parent if exists
            });
            commitSha = commitResponse.data.sha;
            if (!commitSha) {
                throw new Error("Retrieved commit SHA is null");
            }
        } catch (error) {
            return {
                success: false,
                error: {
                    type: "FAILED_TO_CREATE_COMMIT",
                    message: error instanceof Error ? error.message : "Unknown error occurred"
                }
            };
        }

        // Update main branch reference to point to our new commit
        try {
            await octokit.request("PATCH /repos/{owner}/{repo}/git/refs/{ref}", {
                owner: request.owner,
                repo: request.repoName,
                ref: "heads/main",
                sha: commitSha,
                force: true // Force update to replace the initial commit
            });

            console.log(`Successfully updated main branch to commit: ${commitSha}`);

            return {
                success: true,
                repoUrl,
                htmlUrl
            };
        } catch (error) {
            return {
                success: false,
                error: {
                    type: "FAILED_TO_CREATE_BRANCH",
                    message: error instanceof Error ? error.message : "Unknown error occurred"
                }
            };
        }
    } catch (error) {
        console.error("Failed to create repository", error);
        return {
            success: false,
            error: {
                type: "UNKNOWN_ERROR",
                message: error instanceof Error ? error.message : "Unknown error occurred"
            }
        };
    }
}
