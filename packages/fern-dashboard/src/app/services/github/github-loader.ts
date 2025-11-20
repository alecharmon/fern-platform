import "server-only";

import type {
    CreateBranchRequest,
    CreateBranchResult,
    CreateCommitRequest,
    CreateCommitResult,
    CreatePullRequestRequest,
    CreatePullRequestResult,
    CreateRepositoryRequest,
    CreateRepositoryResult,
    FernProject,
    GetDocsYmlAndReferencesResult,
    GetDocsYmlResult,
    GetFernConfigJsonResult,
    GetFernProjectResult,
    GetPullRequestForBranchRequest,
    GetPullRequestForBranchResult,
    GitLoader,
    UpdatePullRequestRequest,
    UpdatePullRequestResult,
    UpdatePullRequestStatusRequest,
    UpdatePullRequestStatusResult,
    ValidateAccessRequest,
    ValidateAccessResult
} from "@fern-api/docs-loader";
import type { Octokit } from "@octokit/core";
import { revalidateTag, unstable_cache } from "next/cache";
import { parseDocsUrlParam } from "@/utils/parseDocsUrlParam";
import type { DocsUrl } from "@/utils/types";
import { getDemoCreationBotOctokit, getFernBotOctokitForRepo } from "../auth0/fernBotOctokit";
import {
    extractReferencedYmlPaths,
    getOwnerAndRepoFromGithubUrl,
    parseFernConfig,
    parseUrlsFromDocsYml,
    stripAndSanitizeUrl
} from "../git-common";
import type { GITHUB_FILE_MODE } from "./types";

export type GitHubAuthMode = "fern-bot" | "demo-creation-bot";

/**
 * The GitHubLoader is used to read from and write to a remote GitHub repository.
 */
export class GitHubLoader implements GitLoader {
    private getOctokitInstance: () => Promise<Octokit | null>;
    private octokit: Octokit | null = null;
    private owner: string;
    private repo: string;

    constructor(
        params: string | { gitUrl: string } | { owner: string; repo: string },
        authMode: GitHubAuthMode = "fern-bot"
    ) {
        if (typeof params === "string") {
            const parsed = getOwnerAndRepoFromGithubUrl(params);
            this.owner = parsed.owner ?? "";
            this.repo = parsed.repo ?? "";
        } else if ("gitUrl" in params) {
            const parsed = getOwnerAndRepoFromGithubUrl(params.gitUrl);
            this.owner = parsed.owner ?? "";
            this.repo = parsed.repo ?? "";
        } else {
            this.owner = params.owner;
            this.repo = params.repo;
        }

        this.getOctokitInstance = async () => {
            if (!this.owner || !this.repo) {
                return null;
            }

            if (authMode === "demo-creation-bot") {
                const result = getDemoCreationBotOctokit();
                return result.ok ? result.octokit : null;
            } else {
                const result = await getFernBotOctokitForRepo(this.owner, this.repo);
                return result.ok ? result.octokit : null;
            }
        };
    }

    async getOctokit() {
        if (this.octokit == null) {
            this.octokit = await this.getOctokitInstance();
        }
        return this.octokit;
    }

    /**
     * Fetches the latest commit SHA for a given ref (branch/tag).
     *
     * Cached with a 5-minute revalidation period for normal browsing.
     * Relies on visibility change events to invalidate cache when user returns to dashboard,
     * minimizing GitHub API usage while still providing fresh data when it matters.
     *
     * Cache can be invalidated via revalidateTag using `github-commit-ref-${owner}-${repo}-${ref}`
     */
    private async getCommitRef(owner: string, repo: string, ref: string): Promise<string | null> {
        return unstable_cache(
            async () => {
                const octokit = await this.getOctokit();
                if (!octokit) {
                    console.error("Failed to get Octokit instance");
                    return null;
                }
                const response = await octokit.request("GET /repos/{owner}/{repo}/commits/{ref}", {
                    owner,
                    repo,
                    ref
                });
                return response.data.sha;
            },
            [`github-commit-ref-${owner}-${repo}-${ref}`],
            {
                revalidate: 60 * 5, // 5 minutes - good for normal browsing, rely on visibility change for freshness
                tags: [`github-commit-ref-${owner}-${repo}-${ref}`, `github-repo-${owner}-${repo}`]
            }
        )();
    }

    /**
     * Helper function to resolve a ref to a commit SHA for stable caching.
     */
    private async resolveRefToSha(owner: string, repo: string, ref: string): Promise<string | null> {
        try {
            return await this.getCommitRef(owner, repo, ref);
        } catch (error) {
            console.error(`Failed to resolve ref ${ref} from ${owner}/${repo}:`, error);
            return null;
        }
    }

    /**
     * Fetches the content of a file from a GitHub repository.
     *
     * - Resolves the ref to a commit SHA for stable cache keys
     * - Fetches raw file content directly (Accept: application/vnd.github.v3.raw) to avoid base64 decoding
     * - Caches aggressively using Next.js unstable_cache with commit SHA-based keys (1 year revalidation)
     * - Stores ETag headers from GitHub API responses
     *
     * @returns The file content as a string, or null if the file cannot be fetched
     */
    private async getFileContent(owner: string, repo: string, ref: string, path: string): Promise<string | null> {
        const commitSha = await this.resolveRefToSha(owner, repo, ref);
        if (!commitSha) {
            console.error(`Failed to resolve ref ${ref} to commit SHA`);
            return null;
        }

        const tag = `github-file:${owner}/${repo}:${path}`;

        return unstable_cache(
            async () => {
                try {
                    const octokit = await this.getOctokit();
                    if (!octokit) {
                        console.error("Failed to get Octokit instance");
                        return null;
                    }

                    const getCached = unstable_cache(
                        async () => {
                            const response = await octokit.request("GET /repos/{owner}/{repo}/contents/{path}", {
                                owner,
                                repo,
                                path,
                                ref: commitSha,
                                headers: { accept: "application/vnd.github.v3.raw" }
                            });

                            const content = response.data as unknown as string;
                            const etag = response.headers.etag ?? "";

                            return { content, etag };
                        },
                        ["github-file", owner, repo, path, commitSha],
                        {
                            revalidate: 60 * 60 * 24 * 365,
                            tags: [tag]
                        }
                    );

                    const cached = await getCached();
                    return cached?.content ?? null;
                } catch (error) {
                    console.error(`Failed to fetch ${path} from ${owner}/${repo}:`, error);
                    return null;
                }
            },
            [`github-file-${owner}-${repo}-${commitSha}-${path}`],
            {
                revalidate: 60 * 60 * 24 * 365,
                tags: [tag]
            }
        )();
    }

    private async getRepository(owner: string, repo: string) {
        return unstable_cache(
            async () => {
                const octokit = await this.getOctokit();
                if (!octokit) {
                    throw new Error("Failed to get Octokit instance");
                }

                try {
                    const repositoryResponse = await octokit.request("GET /repos/{owner}/{repo}", {
                        owner,
                        repo
                    });

                    return repositoryResponse;
                } catch (error: any) {
                    console.error("Failed to get repository", error);
                    if (error?.status === 404) {
                        return null;
                    }

                    throw error; // Don't cache this failure, so throw to skip cache
                }
            },
            [`github-repo-${owner}-${repo}`],
            {
                revalidate: 60 * 60 * 24, // 1 day
                tags: [`github-repo-${owner}-${repo}`]
            }
        )();
    }

    private async getTree(owner: string, repo: string, defaultBranch: string) {
        return unstable_cache(
            async () => {
                const octokit = await this.getOctokit();
                if (!octokit) {
                    throw new Error("Failed to get Octokit instance");
                }

                const treeResponse = await octokit.request("GET /repos/{owner}/{repo}/git/trees/{tree_sha}", {
                    owner,
                    repo,
                    tree_sha: defaultBranch,
                    recursive: "true"
                });

                return treeResponse;
            },
            [`github-tree-${owner}-${repo}-${defaultBranch}`],
            {
                tags: [`github-tree-${owner}-${repo}-${defaultBranch}`]
            }
        )();
    }
    /**
     * Finds a Fern project by site URL using tree searching methodology.
     * Returns the paths to both docs.yml and fern.config.json for the matching project.
     */
    async getFernProjectBySite(owner: string, repo: string, site: DocsUrl): Promise<GetFernProjectResult> {
        const octokit = await this.getOctokit();
        if (!octokit) {
            throw new Error("Failed to get Octokit instance");
        }

        const repository = await this.getRepository(owner, repo);
        if (repository == null) {
            return {
                type: "error",
                error: {
                    type: "REPO_NOT_FOUND"
                }
            };
        }

        const defaultBranch = repository.data.default_branch;
        const treeResponse = await this.getTree(owner, repo, defaultBranch);

        // Find all fern.config.json files
        const fernConfigPaths = treeResponse.data.tree
            .filter(
                (item) =>
                    item.type === "blob" &&
                    item.path.endsWith("fern.config.json") &&
                    item.path.split("/").pop() === "fern.config.json" // Ensure it's exactly "fern.config.json"
            )
            .map((item) => item.path);

        const projects: FernProject[] = [];

        // For each fern.config.json, look for a sibling docs.yml
        for (const fernConfigPath of fernConfigPaths) {
            const fernDir = fernConfigPath.replace("/fern.config.json", "");
            const docsYmlPath = `${fernDir}/docs.yml`;

            // Check if docs.yml exists in the same directory
            const docsYmlExists = treeResponse.data.tree.some(
                (item) => item.type === "blob" && item.path === docsYmlPath
            );

            if (docsYmlExists) {
                projects.push({
                    docsYmlPath,
                    fernConfigJsonPath: fernConfigPath
                });
            }
        }

        if (projects.length === 0) {
            return {
                type: "error",
                error: {
                    type: "NO_PROJECTS"
                }
            };
        }

        const matchingProjects: FernProject[] = [];
        const allFoundSites: string[] = [];
        let firstDocsYmlPath: string | undefined;

        const docsYmlContents = await Promise.all(
            projects.map((project) => this.getFileContent(owner, repo, defaultBranch, project.docsYmlPath))
        );

        for (let i = 0; i < projects.length; i++) {
            const project = projects[i];
            const docsYmlContent = docsYmlContents[i];

            if (docsYmlContent && project) {
                const urls = parseUrlsFromDocsYml(docsYmlContent);
                console.debug(`[getFernProjectBySite] Found URLs: ${urls}`);
                allFoundSites.push(...urls);

                if (!firstDocsYmlPath && urls.length > 0) {
                    firstDocsYmlPath = project.docsYmlPath;
                }

                const strippedUrls = urls.map(stripAndSanitizeUrl);

                console.debug(`[getFernProjectBySite] Stripped URLs: ${strippedUrls}`);

                const strippedSite = stripAndSanitizeUrl(site);
                console.debug(`[getFernProjectBySite] Stripped site: ${strippedSite}`);

                // Check if any URL matches the site
                if (strippedUrls.includes(strippedSite)) {
                    console.debug(`[getFernProjectBySite] Matching project found: ${project.docsYmlPath}`);
                    matchingProjects.push(project);
                }
            }
        }

        // Handle multiple matches as an error
        if (matchingProjects.length > 1) {
            console.error(
                `Multiple Fern projects found with site URL "${site}". Found in: ${matchingProjects
                    .map((p) => p.docsYmlPath)
                    .join(", ")}`
            );
            return {
                type: "error",
                error: { type: "MULTIPLE_PROJECTS_WITH_SITE" }
            };
        }

        const matchingProject = matchingProjects[0];
        // Return success if exactly one project found, or error if none found
        if (matchingProject != null) {
            return {
                type: "ok",
                result: {
                    defaultBranch,
                    project: matchingProject
                }
            };
        } else {
            console.debug(`[getFernProjectBySite] No matching Fern project found for site: ${site}`, {
                allFoundSites,
                firstDocsYmlPath,
                defaultBranch
            });
            return {
                type: "error",
                error: {
                    type: "SITE_NOT_FOUND",
                    searchedSite: site,
                    foundSites: allFoundSites,
                    docsYmlPath: firstDocsYmlPath,
                    defaultBranch
                }
            };
        }
    }

    async getDocsYml(
        owner: string,
        repo: string,
        site: DocsUrl,
        ref: string = "main",
        preferDefaultBranch: boolean = false
    ): Promise<GetDocsYmlResult> {
        const projectResult = await this.getFernProjectBySite(owner, repo, site);
        if (projectResult.type === "error") {
            return {
                type: "error",
                error: projectResult.error
            };
        }

        // Use the default branch from the repository if requested
        const targetRef = preferDefaultBranch ? projectResult.result.defaultBranch : ref;

        const content = await this.getFileContent(owner, repo, targetRef, projectResult.result.project.docsYmlPath);
        if (!content) {
            return {
                type: "error",
                error: { type: "DOCS_YML_MISSING" }
            };
        }

        return {
            type: "ok",
            result: content,
            metadata: {
                path: projectResult.result.project.docsYmlPath,
                defaultBranch: projectResult.result.defaultBranch
            }
        };
    }

    async getDocsYmlAndReferences(
        owner: string,
        repo: string,
        site: DocsUrl,
        ref: string = "main",
        preferDefaultBranch: boolean = false
    ): Promise<GetDocsYmlAndReferencesResult> {
        const mainDocsYmlContent = await this.getDocsYml(owner, repo, site, ref, preferDefaultBranch);
        if (mainDocsYmlContent.type === "error") {
            return {
                type: "error",
                error: mainDocsYmlContent.error
            };
        }

        const docsYmlMap = new Map<string, string>();

        // We consider the main docs.yml to be at the root (referenced files will be relative to it)
        docsYmlMap.set("docs.yml", mainDocsYmlContent.result);

        // Extract referenced yml file paths
        const referencedPaths = extractReferencedYmlPaths(mainDocsYmlContent.result);

        // Get the full path and directory of the main docs.yml file so we can resolve referenced file paths
        const mainDocsYmlPath = mainDocsYmlContent.metadata.path;
        const docsYmlDir = mainDocsYmlPath.substring(0, mainDocsYmlPath.lastIndexOf("/"));

        // If no referenced files, return map with just the main docs.yml
        if (referencedPaths.length === 0) {
            return {
                type: "ok",
                result: docsYmlMap,
                metadata: {
                    // Assume the fern folder path is the directory of the root docs.yml file
                    fernFolderPath: docsYmlDir
                }
            };
        }

        // Use the default branch from the repository if requested
        const targetRef = preferDefaultBranch ? mainDocsYmlContent.metadata.defaultBranch : ref;

        const referencedFilePromises = referencedPaths.map(async (relativePath) => {
            if (relativePath.startsWith("../")) {
                throw new Error(`docs.yml does not allow referencing files outside of its directory: ${relativePath}`);
            }
            // Normalize the relative path (remove ./ prefix if present)
            const normalizedPath = relativePath.startsWith("./") ? relativePath.substring(2) : relativePath;
            // Construct absolute path (docs.yml location is considered the root directory)
            const absolutePath = docsYmlDir ? `${docsYmlDir}/${normalizedPath}` : normalizedPath;

            const fileContent = await this.getFileContent(owner, repo, targetRef, absolutePath);
            if (fileContent) {
                // Store with the relative path as key (normalized)
                docsYmlMap.set(normalizedPath, fileContent);
            } else {
                console.warn(`Failed to load referenced yml file: ${absolutePath}`);
            }
        });

        await Promise.all(referencedFilePromises);

        return {
            type: "ok",
            result: docsYmlMap,
            metadata: {
                // Assume the fern folder path is the directory of the root docs.yml file
                fernFolderPath: docsYmlDir
            }
        };
    }

    async getFernConfigJson(owner: string, repo: string, site: DocsUrl): Promise<GetFernConfigJsonResult> {
        const projectResult = await this.getFernProjectBySite(owner, repo, site);
        if (projectResult.type === "error") {
            return {
                type: "error",
                error: projectResult.error
            };
        }

        const pathToFernConfigJson = projectResult.result.project.fernConfigJsonPath;

        const content = await this.getFileContent(
            owner,
            repo,
            projectResult.result.defaultBranch,
            pathToFernConfigJson
        );
        if (!content) {
            return {
                type: "error",
                error: { type: "FERN_CONFIG_JSON_MISSING" }
            };
        }

        const maybeConfig = parseFernConfig(content);
        if (!maybeConfig) {
            return {
                type: "error",
                error: {
                    type: "FERN_CONFIG_JSON_MALFORMED",
                    parsingErrorMessage: "Failed to parse fern.config.json"
                }
            };
        }

        return {
            type: "ok",
            result: {
                ...maybeConfig,
                pathToFernConfigJson
            }
        };
    }

    /**
     * Validates that the bot has access to the repository and that the
     * fern.config.json organization matches the expected organization.
     */
    async validateAccess(request: ValidateAccessRequest): Promise<ValidateAccessResult> {
        // Check if bot is installed
        const octokit = await this.getOctokit();
        if (!octokit) {
            return {
                type: "error",
                error: {
                    type: "BOT_NOT_INSTALLED",
                    owner: request.owner,
                    repo: request.repo
                }
            };
        }

        // Get fern.config.json from the repository
        const site = parseDocsUrlParam({ docsUrl: request.site });
        const fernConfigResult = await this.getFernConfigJson(request.owner, request.repo, site);

        if (fernConfigResult.type === "error") {
            // Map fern config errors to access errors
            const fernError = fernConfigResult.error;
            switch (fernError.type) {
                case "FERN_CONFIG_JSON_MISSING":
                    return {
                        type: "error",
                        error: { type: "CONFIG_MISSING" }
                    };
                case "FERN_CONFIG_JSON_MALFORMED":
                    return {
                        type: "error",
                        error: {
                            type: "CONFIG_MALFORMED",
                            message: fernError.parsingErrorMessage
                        }
                    };
                default:
                    return {
                        type: "error",
                        error: {
                            type: "UNEXPECTED_ERROR",
                            message: `Failed to fetch config: ${fernError.type}`
                        }
                    };
            }
        }

        const fernConfig = fernConfigResult.result;

        // Verify organization matches
        if (fernConfig.organization !== request.orgName) {
            return {
                type: "error",
                error: {
                    type: "CONFIG_ORG_MISMATCH",
                    expected: request.orgName,
                    actual: fernConfig.organization
                }
            };
        }

        return { type: "ok" };
    }

    /**
     * Creates a commit on a branch with the specified files.
     * Supports file additions, modifications, and deletions.
     */
    async createCommit(request: CreateCommitRequest): Promise<CreateCommitResult> {
        const octokit = await this.getOctokit();
        if (!octokit) {
            return {
                type: "error",
                error: {
                    type: "OPERATION_FAILED",
                    message: "Failed to get GitHub client"
                }
            };
        }

        try {
            // Get the current branch SHA
            let baseSha: string;
            try {
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
                    type: "error",
                    error: {
                        type: "RESOURCE_NOT_FOUND",
                        message: `Branch ${request.branch} not found: ${error instanceof Error ? error.message : "Unknown error"}`
                    }
                };
            }

            // Get the current tree SHA
            let baseTreeSha: string;
            try {
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
                    type: "error",
                    error: {
                        type: "OPERATION_FAILED",
                        message: `Failed to get tree: ${error instanceof Error ? error.message : "Unknown error"}`
                    }
                };
            }

            // If there are files to delete, get the existing files in the base tree
            const hasFilesToDelete = request.files.some((file) => file.delete);
            let existingFiles: Set<string> = new Set();

            if (hasFilesToDelete) {
                try {
                    const baseTreeResponse = await octokit.request("GET /repos/{owner}/{repo}/git/trees/{tree_sha}", {
                        owner: request.owner,
                        repo: request.repo,
                        tree_sha: baseTreeSha,
                        recursive: "true"
                    });
                    if (!baseTreeResponse.data.tree) {
                        throw new Error("Retrieved file tree is null");
                    }
                    existingFiles = new Set(
                        baseTreeResponse.data.tree.filter((item) => item.type === "blob").map((item) => item.path) || []
                    );
                } catch (error) {
                    return {
                        type: "error",
                        error: {
                            type: "OPERATION_FAILED",
                            message: `Failed to get file tree: ${error instanceof Error ? error.message : "Unknown error"}`
                        }
                    };
                }
            }

            // Create the tree with file changes
            const tree = request.files
                .map((file) => {
                    if (file.delete) {
                        // Only include deletion entries for files that actually exist
                        if (!existingFiles.has(file.path)) {
                            console.warn(`File ${file.path} does not exist in the base tree, skipping deletion`);
                            return null;
                        }
                        return {
                            path: file.path,
                            mode: "100644" as GITHUB_FILE_MODE,
                            type: "blob" as const,
                            sha: null
                        };
                    } else {
                        if (file.content == null) {
                            throw new Error(`File ${file.path} has no content`);
                        }
                        return {
                            path: file.path,
                            mode: "100644" as GITHUB_FILE_MODE,
                            type: "blob" as const,
                            content: file.content
                        };
                    }
                })
                .filter((item) => item != null);

            // Create new tree
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
                    type: "error",
                    error: {
                        type: "OPERATION_FAILED",
                        message: `Failed to create tree: ${error instanceof Error ? error.message : "Unknown error"}`
                    }
                };
            }

            // Create commit
            let commitSha: string;
            try {
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
                    type: "error",
                    error: {
                        type: "OPERATION_FAILED",
                        message: `Failed to create commit: ${error instanceof Error ? error.message : "Unknown error"}`
                    }
                };
            }

            // Update branch reference
            try {
                await octokit.request("PATCH /repos/{owner}/{repo}/git/refs/{ref}", {
                    owner: request.owner,
                    repo: request.repo,
                    ref: `heads/${request.branch}`,
                    sha: commitSha
                });

                return {
                    type: "ok",
                    commitSha
                };
            } catch (error) {
                return {
                    type: "error",
                    error: {
                        type: "OPERATION_FAILED",
                        message: `Failed to update branch: ${error instanceof Error ? error.message : "Unknown error"}`
                    }
                };
            }
        } catch (error) {
            console.error("Failed to create commit", error);
            return {
                type: "error",
                error: {
                    type: "UNKNOWN_ERROR",
                    message: error instanceof Error ? error.message : "Unknown error occurred"
                }
            };
        }
    }

    /**
     * Creates a new branch from a base branch, or returns success if the branch already exists.
     */
    async createBranch(request: CreateBranchRequest): Promise<CreateBranchResult> {
        const octokit = await this.getOctokit();
        if (!octokit) {
            return {
                type: "error",
                error: {
                    type: "OPERATION_FAILED",
                    message: "Failed to get GitHub client"
                }
            };
        }

        try {
            // Check if the branch already exists
            try {
                const existingBranchResponse = await octokit.request("GET /repos/{owner}/{repo}/git/ref/{ref}", {
                    owner: request.owner,
                    repo: request.repo,
                    ref: `heads/${request.branch}`
                });

                return {
                    type: "ok",
                    baseSha: existingBranchResponse.data.object.sha,
                    alreadyExists: true
                };
            } catch (branchCheckError: any) {
                if (branchCheckError.status !== 404) {
                    throw branchCheckError;
                }
            }

            // Get the latest commit SHA on base branch
            const {
                data: {
                    object: { sha: baseSha }
                }
            } = await octokit.request("GET /repos/{owner}/{repo}/git/ref/{ref}", {
                owner: request.owner,
                repo: request.repo,
                ref: `heads/${request.baseBranch}`
            });

            // Create the new branch
            await octokit.request("POST /repos/{owner}/{repo}/git/refs", {
                owner: request.owner,
                repo: request.repo,
                ref: `refs/heads/${request.branch}`,
                sha: baseSha
            });

            return {
                type: "ok",
                baseSha,
                alreadyExists: false
            };
        } catch (error) {
            console.error("Failed to create branch", error);
            return {
                type: "error",
                error: {
                    type: "UNKNOWN_ERROR",
                    message: error instanceof Error ? error.message : "Unknown error occurred"
                }
            };
        }
    }

    /**
     * Creates a pull request.
     */
    async createPullRequest(request: CreatePullRequestRequest): Promise<CreatePullRequestResult> {
        const octokit = await this.getOctokit();
        if (!octokit) {
            return {
                type: "error",
                error: {
                    type: "OPERATION_FAILED",
                    message: "Failed to get GitHub client"
                }
            };
        }

        try {
            const response = await octokit.request("POST /repos/{owner}/{repo}/pulls", {
                owner: request.owner,
                repo: request.repo,
                head: request.head,
                base: request.base,
                title: request.title,
                body: request.body,
                draft: request.draft || false
            });

            return {
                type: "ok",
                prUrl: response.data.html_url,
                prNumber: response.data.number
            };
        } catch (error) {
            console.error("Failed to create pull request", error);
            return {
                type: "error",
                error: {
                    type: "UNKNOWN_ERROR",
                    message: error instanceof Error ? error.message : "Unknown error occurred"
                }
            };
        }
    }

    /**
     * Updates a pull request's title and/or body.
     */
    async updatePullRequest(request: UpdatePullRequestRequest): Promise<UpdatePullRequestResult> {
        const octokit = await this.getOctokit();
        if (!octokit) {
            return {
                type: "error",
                error: {
                    type: "OPERATION_FAILED",
                    message: "Failed to get GitHub client"
                }
            };
        }

        try {
            await octokit.request("PATCH /repos/{owner}/{repo}/pulls/{pull_number}", {
                owner: request.owner,
                repo: request.repo,
                pull_number: request.prNumber,
                title: request.title,
                body: request.body
            });

            return { type: "ok" };
        } catch (error) {
            console.error("Failed to update pull request", error);
            return {
                type: "error",
                error: {
                    type: "UNKNOWN_ERROR",
                    message: error instanceof Error ? error.message : "Unknown error occurred"
                }
            };
        }
    }

    /**
     * Updates a pull request's status (converts between draft and ready for review).
     */
    async updatePullRequestStatus(request: UpdatePullRequestStatusRequest): Promise<UpdatePullRequestStatusResult> {
        const octokit = await this.getOctokit();
        if (!octokit) {
            return {
                type: "error",
                error: {
                    type: "OPERATION_FAILED",
                    message: "Failed to get GitHub client"
                }
            };
        }

        try {
            // Find PR for the branch
            const response = await octokit.request("GET /repos/{owner}/{repo}/pulls", {
                owner: request.owner,
                repo: request.repo,
                head: `${request.owner}:${request.branch}`,
                base: request.baseBranch,
                state: "all"
            });

            if (response.data.length === 0) {
                return {
                    type: "error",
                    error: {
                        type: "RESOURCE_NOT_FOUND",
                        message: "No PR found for this branch"
                    }
                };
            }

            const openPrs = response.data.filter((pr) => pr.state === "open");
            const pr = openPrs[0] || response.data[0];

            if (!pr?.node_id) {
                return {
                    type: "error",
                    error: {
                        type: "RESOURCE_NOT_FOUND",
                        message: "No PR found for this branch"
                    }
                };
            }

            // Update PR status using GraphQL mutations
            if (request.status === "open") {
                const mutation = `mutation MarkPullRequestReadyForReview($pullRequestId: ID!) {
                    markPullRequestReadyForReview(input: { pullRequestId: $pullRequestId }) {
                        clientMutationId
                    }
                }`;

                await octokit.graphql(mutation, {
                    pullRequestId: pr.node_id
                });

                return {
                    type: "ok",
                    status: "open",
                    prNumber: pr.number,
                    prUrl: pr.html_url
                };
            } else if (request.status === "draft") {
                const mutation = `mutation ConvertPullRequestToDraft($pullRequestId: ID!) {
                    convertPullRequestToDraft(input: { pullRequestId: $pullRequestId }) {
                        pullRequest {
                            id
                            isDraft
                        }
                    }
                }`;

                await octokit.graphql(mutation, {
                    pullRequestId: pr.node_id
                });

                return {
                    type: "ok",
                    status: "draft",
                    prNumber: pr.number,
                    prUrl: pr.html_url
                };
            }

            return {
                type: "error",
                error: {
                    type: "OPERATION_FAILED",
                    message: `Invalid status: ${request.status}`
                }
            };
        } catch (error) {
            console.error("Failed to update pull request status", error);
            return {
                type: "error",
                error: {
                    type: "UNKNOWN_ERROR",
                    message: error instanceof Error ? error.message : "Unknown error occurred"
                }
            };
        }
    }

    /**
     * Creates a new GitHub repository with initial files.
     */
    async createRepository(request: CreateRepositoryRequest): Promise<CreateRepositoryResult> {
        const octokit = await this.getOctokit();
        if (!octokit) {
            return {
                type: "error",
                error: {
                    type: "OPERATION_FAILED",
                    message: "Failed to get GitHub client"
                }
            };
        }

        try {
            // Determine if owner is user or org
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

            // Create repository
            let gitUrl: string;
            let htmlUrl: string;
            try {
                let createRepoResponse;
                if (ownerType === "org") {
                    createRepoResponse = await octokit.request("POST /orgs/{org}/repos", {
                        org: request.owner,
                        name: request.repoName,
                        description: request.description || "Fern documentation",
                        private: request.isPrivate ?? true,
                        auto_init: true
                    });
                } else {
                    createRepoResponse = await octokit.request("POST /user/repos", {
                        name: request.repoName,
                        description: request.description || "Fern documentation",
                        private: request.isPrivate ?? true,
                        auto_init: true
                    });
                }

                gitUrl = createRepoResponse.data.clone_url;
                htmlUrl = createRepoResponse.data.html_url;

                if (!gitUrl || !htmlUrl) {
                    throw new Error("Failed to get repository URLs from response");
                }
            } catch (error) {
                return {
                    type: "error",
                    error: {
                        type: "OPERATION_FAILED",
                        message: `Failed to create repository: ${error instanceof Error ? error.message : "Unknown error"}`
                    }
                };
            }

            // Wait for repository initialization and get base tree SHA
            let baseTreeSha: string | undefined;
            let retries = 10;
            while (retries > 0) {
                try {
                    await new Promise((resolve) => setTimeout(resolve, 1000));

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
                    break;
                } catch (error) {
                    retries--;
                    if (retries === 0) {
                        console.error("Failed to get base tree after all retries:", error);
                        throw new Error("Repository initialization timeout");
                    }
                    console.log(`Waiting for repo to initialize... (${retries} retries left)`);
                }
            }

            // Create tree with files
            const tree = request.files.map((file) => ({
                path: file.path,
                mode: "100644" as GITHUB_FILE_MODE,
                type: "blob" as const,
                content: file.content
            }));

            let treeSha: string;
            try {
                const treeResponse = await octokit.request("POST /repos/{owner}/{repo}/git/trees", {
                    owner: request.owner,
                    repo: request.repoName,
                    tree,
                    base_tree: baseTreeSha
                });
                treeSha = treeResponse.data.sha;
                if (!treeSha) {
                    throw new Error("Retrieved tree SHA is null");
                }
            } catch (error: any) {
                return {
                    type: "error",
                    error: {
                        type: "OPERATION_FAILED",
                        message: `Failed to create tree: ${error instanceof Error ? error.message : "Unknown error"}`
                    }
                };
            }

            // Get parent commit SHA
            let parentCommitSha: string | undefined;
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

            // Create commit
            let commitSha: string;
            try {
                const commitResponse = await octokit.request("POST /repos/{owner}/{repo}/git/commits", {
                    owner: request.owner,
                    repo: request.repoName,
                    message: "Add Fern documentation",
                    tree: treeSha,
                    parents: parentCommitSha ? [parentCommitSha] : []
                });
                commitSha = commitResponse.data.sha;
                if (!commitSha) {
                    throw new Error("Retrieved commit SHA is null");
                }
            } catch (error) {
                return {
                    type: "error",
                    error: {
                        type: "OPERATION_FAILED",
                        message: `Failed to create commit: ${error instanceof Error ? error.message : "Unknown error"}`
                    }
                };
            }

            // Update main branch
            try {
                await octokit.request("PATCH /repos/{owner}/{repo}/git/refs/{ref}", {
                    owner: request.owner,
                    repo: request.repoName,
                    ref: "heads/main",
                    sha: commitSha,
                    force: true
                });

                return {
                    type: "ok",
                    repoUrl: gitUrl,
                    htmlUrl
                };
            } catch (error) {
                return {
                    type: "error",
                    error: {
                        type: "OPERATION_FAILED",
                        message: `Failed to update branch: ${error instanceof Error ? error.message : "Unknown error"}`
                    }
                };
            }
        } catch (error) {
            console.error("Failed to create repository", error);
            return {
                type: "error",
                error: {
                    type: "UNKNOWN_ERROR",
                    message: error instanceof Error ? error.message : "Unknown error occurred"
                }
            };
        }
    }

    /**
     * Gets PR information for a branch.
     */
    async getPullRequestForBranch(request: GetPullRequestForBranchRequest): Promise<GetPullRequestForBranchResult> {
        const octokit = await this.getOctokit();
        if (!octokit) {
            return {
                type: "error",
                error: "Failed to get GitHub client"
            };
        }

        try {
            // Find associated PRs for the branch
            const response = await octokit.request("GET /repos/{owner}/{repo}/pulls", {
                owner: request.owner,
                repo: request.repo,
                head: `${request.owner}:${request.branch}`,
                base: request.baseBranch,
                state: "all"
            });

            if (response.data.length === 0) {
                return {
                    type: "error",
                    error: "No associated PRs found for this branch"
                };
            }

            const openPrs = response.data.filter((pr) => pr.state === "open");

            if (openPrs.length > 1) {
                return {
                    type: "error",
                    error: "Multiple open PRs found for this branch"
                };
            }

            const pr = openPrs[0] || response.data[0];

            if (!pr) {
                return {
                    type: "error",
                    error: "No PR found for this branch"
                };
            }

            return {
                type: "ok",
                title: pr.title,
                prNumber: pr.number,
                prUrl: pr.html_url,
                status: pr.state,
                draft: pr.draft || false,
                merged: pr.merged_at != null,
                nodeId: pr.node_id
            };
        } catch (error) {
            console.error("Failed to fetch PR for branch", error);
            return {
                type: "error",
                error: error instanceof Error ? error.message : "Unknown error occurred"
            };
        }
    }
}

/**
 * Invalidates the commit ref cache for a specific branch.
 * This should be called when:
 * - A PR is merged to the branch
 * - The branch HEAD is updated
 * - getFernVersionFromRepo detects a version change
 *
 * This will force the next call to getCommitRef to fetch the latest commit SHA from GitHub.
 */
export function invalidateCommitRefCache(owner: string, repo: string, ref: string): void {
    revalidateTag(`github-commit-ref-${owner}-${repo}-${ref}`);
}

/**
 * Invalidates all GitHub-related caches for a repository.
 * Use this when you want to force a complete refresh of all cached data.
 */
export function invalidateRepoCache(owner: string, repo: string): void {
    revalidateTag(`github-repo-${owner}-${repo}`);
}
