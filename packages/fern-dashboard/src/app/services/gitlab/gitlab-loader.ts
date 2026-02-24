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

import { type CommitAction, Gitlab } from "@gitbeaker/rest";
import { revalidateTag, unstable_cache } from "next/cache";

import type { DocsUrl } from "@/utils/types";

import {
    extractReferencedYmlPaths,
    getOwnerAndRepoFromGitlabUrl,
    parseFernConfig,
    parseUrlsFromDocsYml,
    stripAndSanitizeUrl
} from "../git-common";
import { getGitlabToken } from "./gitlab-token";

export type GitLabAuthMode = "production" | "demo";

export class GitLabLoader implements GitLoader {
    private gitlabInstance: Gitlab | null = null;
    private owner: string;
    private repo: string;
    private authMode: GitLabAuthMode;

    constructor(
        params: string | { gitlabUrl: string } | { owner: string; repo: string },
        authMode: GitLabAuthMode = "production"
    ) {
        if (typeof params === "string") {
            const parsed = getOwnerAndRepoFromGitlabUrl(params);
            this.owner = parsed.owner ?? "";
            // For GitLab, 'path' contains the full path (including subgroups and repo)
            // We store it in 'repo' for compatibility with existing code
            this.repo = parsed.path ?? parsed.repo ?? "";
        } else if ("gitlabUrl" in params) {
            const parsed = getOwnerAndRepoFromGitlabUrl(params.gitlabUrl);
            this.owner = parsed.owner ?? "";
            // For GitLab, 'path' contains the full path (including subgroups and repo)
            // We store it in 'repo' for compatibility with existing code
            this.repo = parsed.path ?? parsed.repo ?? "";
        } else {
            this.owner = params.owner;
            this.repo = params.repo;
        }

        this.authMode = authMode;
    }

    private async getGitlab(): Promise<Gitlab | null> {
        if (this.gitlabInstance == null) {
            if (!this.owner || !this.repo) {
                console.error("[GitLabLoader.getGitlab] Owner or repo not set:", {
                    owner: this.owner,
                    repo: this.repo
                });
                return null;
            }

            console.log(`[GitLabLoader.getGitlab] Looking up token for owner: ${this.owner}, repo: ${this.repo}`);
            const token = await getGitlabToken(this.owner, this.repo);
            if (!token) {
                console.error(`[GitLabLoader.getGitlab] Failed to get GitLab token for ${this.owner}/${this.repo}`);
                return null;
            }

            console.log(`[GitLabLoader.getGitlab] Token found, creating Gitlab instance`);
            this.gitlabInstance = new Gitlab({
                token
            });
        }
        return this.gitlabInstance;
    }

    private getProjectId(): string {
        // For GitLab, this.repo contains the full path (e.g., "team/subteam/my-repo")
        // So the project ID will be "owner/team/subteam/my-repo"
        return `${this.owner}/${this.repo}`;
    }

    private async getCommitRef(owner: string, repo: string, ref: string): Promise<string | null> {
        // Throw inside the cached function so transient errors are NOT cached by unstable_cache.
        try {
            return await unstable_cache(
                async () => {
                    const gitlab = await this.getGitlab();
                    if (!gitlab) {
                        throw new Error(`Failed to get GitLab instance for ${owner}/${repo}`);
                    }

                    const projectId = `${owner}/${repo}`;
                    const commit = await gitlab.Commits.show(projectId, ref);
                    return commit.id;
                },
                [`gitlab-commit-ref-${owner}-${repo}-${ref}`],
                {
                    revalidate: 60 * 5,
                    tags: [`gitlab-commit-ref-${owner}-${repo}-${ref}`, `gitlab-repo-${owner}-${repo}`]
                }
            )();
        } catch (error) {
            console.error(`Failed to get commit ref for ${ref} from ${owner}/${repo}:`, error);
            return null;
        }
    }

    private async resolveRefToSha(owner: string, repo: string, ref: string): Promise<string | null> {
        const commitSha = await this.getCommitRef(owner, repo, ref);
        if (!commitSha) {
            console.error(`Failed to resolve ref ${ref} to commit SHA`);
            return null;
        }
        return commitSha;
    }

    private async getFileContent(owner: string, repo: string, ref: string, path: string): Promise<string | null> {
        const commitSha = await this.resolveRefToSha(owner, repo, ref);
        if (!commitSha) {
            console.error(`Failed to resolve ref ${ref} to commit SHA`);
            return null;
        }

        const tag = `gitlab-file:${owner}/${repo}:${path}`;

        // Throw inside the cached function so transient errors are NOT cached by unstable_cache.
        // Only successful results should be cached (file content at a commit SHA is immutable).
        try {
            return await unstable_cache(
                async () => {
                    const gitlab = await this.getGitlab();
                    if (!gitlab) {
                        throw new Error(`Failed to get GitLab instance for ${owner}/${repo}`);
                    }

                    const projectId = `${owner}/${repo}`;
                    const file = await gitlab.RepositoryFiles.show(projectId, path, commitSha);

                    if (file.encoding === "base64" && file.content) {
                        const content = Buffer.from(file.content, "base64").toString("utf-8");
                        return content;
                    }

                    return file.content || "";
                },
                [`gitlab-file-${owner}-${repo}-${commitSha}-${path}`],
                {
                    revalidate: 60 * 60 * 24, // 24 hours
                    tags: [tag]
                }
            )();
        } catch (error) {
            console.error(`Failed to fetch ${path} from ${owner}/${repo}:`, error);
            return null;
        }
    }

    private async getRepository(owner: string, repo: string) {
        return unstable_cache(
            async () => {
                const gitlab = await this.getGitlab();
                if (!gitlab) {
                    throw new Error("Failed to get GitLab instance");
                }

                try {
                    const projectId = `${owner}/${repo}`;
                    const project = await gitlab.Projects.show(projectId);
                    return project;
                } catch (error: any) {
                    console.error("Failed to get repository", error);
                    // Handle 404 from various gitbeaker error structures
                    const is404 =
                        error?.cause?.response?.statusCode === 404 ||
                        error?.response?.status === 404 ||
                        error?.statusCode === 404 ||
                        error?.message?.includes("404");
                    if (is404) {
                        return null;
                    }
                    throw error;
                }
            },
            [`gitlab-repo-${owner}-${repo}`],
            {
                revalidate: 60 * 60 * 24,
                tags: [`gitlab-repo-${owner}-${repo}`]
            }
        )();
    }

    private async getTree(owner: string, repo: string, ref: string, path?: string) {
        return unstable_cache(
            async () => {
                const gitlab = await this.getGitlab();
                if (!gitlab) {
                    throw new Error("Failed to get GitLab instance");
                }

                try {
                    const projectId = `${owner}/${repo}`;
                    const tree = await gitlab.Repositories.allRepositoryTrees(projectId, {
                        ref,
                        path: path || "",
                        recursive: true
                    });
                    return tree;
                } catch (error) {
                    console.error("Failed to get tree", error);
                    throw error;
                }
            },
            [`gitlab-tree-${owner}-${repo}-${ref}-${path || ""}`],
            {
                revalidate: 60 * 5,
                tags: [`gitlab-tree-${owner}-${repo}-${ref}`, `gitlab-repo-${owner}-${repo}`]
            }
        )();
    }

    async getFernProjectBySite(owner: string, repo: string, site: string): Promise<GetFernProjectResult> {
        const repository = await this.getRepository(owner, repo);
        if (!repository) {
            return {
                type: "error",
                error: { type: "REPO_NOT_FOUND" }
            };
        }

        const defaultBranch = repository.default_branch || "main";

        const fernConfigPaths = [
            "fern/fern.config.json",
            ".fern/fern.config.json",
            "fern.config.json",
            ".fern.config.json"
        ];

        let docsYmlExists = false;
        let docsYmlPath: string | null = null;
        let fernConfigJsonPath: string | null = null;

        try {
            const tree = await this.getTree(owner, repo, defaultBranch);

            for (const item of tree) {
                if (item.type === "blob") {
                    if (item.path === "fern/docs.yml" || item.path === ".fern/docs.yml") {
                        docsYmlExists = true;
                        docsYmlPath = item.path;
                    }

                    if (fernConfigPaths.includes(item.path)) {
                        fernConfigJsonPath = item.path;
                    }
                }
            }
        } catch (error) {
            console.error("Failed to get tree:", error);
            return {
                type: "error",
                error: { type: "NO_PROJECTS" }
            };
        }

        if (!docsYmlExists || !docsYmlPath) {
            return {
                type: "error",
                error: { type: "NO_PROJECTS" }
            };
        }

        if (!fernConfigJsonPath) {
            return {
                type: "error",
                error: { type: "NO_PROJECTS" }
            };
        }

        const docsYmlContents = await this.getFileContent(owner, repo, defaultBranch, docsYmlPath);
        if (!docsYmlContents) {
            return {
                type: "error",
                error: { type: "NO_PROJECTS" }
            };
        }

        const urls = parseUrlsFromDocsYml(docsYmlContents);
        const sanitizedSite = stripAndSanitizeUrl(site);
        const matchingSite = urls.find((url) => stripAndSanitizeUrl(url) === sanitizedSite);

        if (!matchingSite) {
            return {
                type: "error",
                error: {
                    type: "SITE_NOT_FOUND",
                    searchedSite: site,
                    foundSites: urls,
                    docsYmlPath,
                    defaultBranch
                }
            };
        }

        const _fernFolderPath = docsYmlPath.includes("/") ? docsYmlPath.split("/").slice(0, -1).join("/") : "";

        const project: FernProject = {
            docsYmlPath,
            fernConfigJsonPath
        };

        return {
            type: "ok",
            result: {
                project,
                defaultBranch
            }
        };
    }

    async getDocsYml(
        owner: string,
        repo: string,
        site: string,
        ref?: string,
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
        const targetRef = preferDefaultBranch
            ? projectResult.result.defaultBranch
            : ref || projectResult.result.defaultBranch;
        const docsYmlPath = projectResult.result.project.docsYmlPath;

        const content = await this.getFileContent(owner, repo, targetRef, docsYmlPath);
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
                path: docsYmlPath,
                defaultBranch: projectResult.result.defaultBranch
            }
        };
    }

    async getDocsYmlAndReferences(
        owner: string,
        repo: string,
        site: string,
        ref?: string,
        preferDefaultBranch: boolean = false
    ): Promise<GetDocsYmlAndReferencesResult> {
        const projectResult = await this.getFernProjectBySite(owner, repo, site);
        if (projectResult.type === "error") {
            return {
                type: "error",
                error: projectResult.error
            };
        }

        // Use the default branch from the repository if requested
        const targetRef = preferDefaultBranch
            ? projectResult.result.defaultBranch
            : ref || projectResult.result.defaultBranch;
        const docsYmlPath = projectResult.result.project.docsYmlPath;

        const rootDocsYmlContent = await this.getFileContent(owner, repo, targetRef, docsYmlPath);
        if (!rootDocsYmlContent) {
            return {
                type: "error",
                error: { type: "DOCS_YML_MISSING" }
            };
        }

        const docsYmlMap = new Map<string, string>();
        docsYmlMap.set("docs.yml", rootDocsYmlContent);

        const referencedPaths = extractReferencedYmlPaths(rootDocsYmlContent);
        const docsYmlDir = docsYmlPath.includes("/") ? docsYmlPath.split("/").slice(0, -1).join("/") : "";

        const referencedFilePromises = referencedPaths.map(async (relativePath) => {
            const normalizedPath = relativePath.startsWith("./") ? relativePath.slice(2) : relativePath;
            const absolutePath = docsYmlDir ? `${docsYmlDir}/${normalizedPath}` : normalizedPath;

            const fileContent = await this.getFileContent(owner, repo, targetRef, absolutePath);
            if (fileContent) {
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

    async validateAccess(request: ValidateAccessRequest): Promise<ValidateAccessResult> {
        const gitlab = await this.getGitlab();
        if (!gitlab) {
            return {
                type: "error",
                error: {
                    type: "BOT_NOT_INSTALLED",
                    owner: request.owner,
                    repo: request.repo
                }
            };
        }

        // Get repository info to find default branch
        const repository = await this.getRepository(request.owner, request.repo);
        if (!repository) {
            return {
                type: "error",
                error: { type: "CONFIG_MISSING" }
            };
        }

        const defaultBranch = repository.default_branch || "main";

        // Find fern.config.json in the repository
        const fernConfigPaths = [
            "fern/fern.config.json",
            ".fern/fern.config.json",
            "fern.config.json",
            ".fern.config.json"
        ];

        let fernConfigJsonPath: string | null = null;

        try {
            const tree = await this.getTree(request.owner, request.repo, defaultBranch);
            for (const item of tree) {
                if (item.type === "blob" && fernConfigPaths.includes(item.path)) {
                    fernConfigJsonPath = item.path;
                    break;
                }
            }
        } catch (error) {
            console.error("Failed to get tree for validation:", error);
            return {
                type: "error",
                error: { type: "CONFIG_MISSING" }
            };
        }

        if (!fernConfigJsonPath) {
            return {
                type: "error",
                error: { type: "CONFIG_MISSING" }
            };
        }

        // Fetch and parse fern.config.json
        const fernConfigContent = await this.getFileContent(
            request.owner,
            request.repo,
            defaultBranch,
            fernConfigJsonPath
        );
        if (!fernConfigContent) {
            return {
                type: "error",
                error: { type: "CONFIG_MISSING" }
            };
        }

        const maybeConfig = parseFernConfig(fernConfigContent);
        if (!maybeConfig) {
            return {
                type: "error",
                error: {
                    type: "CONFIG_MALFORMED",
                    message: "Failed to parse fern.config.json"
                }
            };
        }

        // Verify organization matches
        if (maybeConfig.organization !== request.orgName) {
            return {
                type: "error",
                error: {
                    type: "CONFIG_ORG_MISMATCH",
                    expected: request.orgName,
                    actual: maybeConfig.organization
                }
            };
        }

        return { type: "ok" };
    }

    async createCommit(request: CreateCommitRequest): Promise<CreateCommitResult> {
        const gitlab = await this.getGitlab();
        if (!gitlab) {
            return {
                type: "error",
                error: {
                    type: "OPERATION_FAILED",
                    message: "Failed to get GitLab instance"
                }
            };
        }

        try {
            const projectId = this.getProjectId();

            // Get list of existing files to determine if we should create or update
            let existingFiles: Set<string> = new Set();
            try {
                const tree = await gitlab.Repositories.allRepositoryTrees(projectId, {
                    ref: request.branch,
                    recursive: true
                });
                existingFiles = new Set(tree.filter((item: any) => item.type === "blob").map((item: any) => item.path));
            } catch (error) {
                console.warn("Failed to get existing files, assuming all are new:", error);
            }

            const actions = request.files.map((file) => {
                if ("delete" in file && file.delete) {
                    return {
                        action: "delete",
                        filePath: file.path
                    } as CommitAction;
                }

                // Check if file exists to determine action
                const fileExists = existingFiles.has(file.path);
                return {
                    action: fileExists ? "update" : "create",
                    filePath: file.path,
                    content: file.content
                } as CommitAction;
            });

            const commit = await gitlab.Commits.create(projectId, request.branch, request.message, actions);

            return {
                type: "ok",
                commitSha: commit.id
            };
        } catch (error) {
            console.error("Failed to create commit:", error);
            return {
                type: "error",
                error: {
                    type: "OPERATION_FAILED",
                    message: error instanceof Error ? error.message : "Failed to create commit"
                }
            };
        }
    }

    async createBranch(request: CreateBranchRequest): Promise<CreateBranchResult> {
        const gitlab = await this.getGitlab();
        if (!gitlab) {
            return {
                type: "error",
                error: {
                    type: "OPERATION_FAILED",
                    message: "Failed to get GitLab instance"
                }
            };
        }

        try {
            const projectId = this.getProjectId();

            // Check if the branch already exists
            try {
                const existingBranch = await gitlab.Branches.show(projectId, request.branch);
                return {
                    type: "ok",
                    baseSha: existingBranch.commit.id,
                    alreadyExists: true
                };
            } catch (branchCheckError: any) {
                // If 404, branch doesn't exist - continue to create it
                // Check multiple possible error structures from gitbeaker
                const is404 =
                    branchCheckError?.cause?.response?.statusCode === 404 ||
                    branchCheckError?.response?.status === 404 ||
                    branchCheckError?.statusCode === 404 ||
                    branchCheckError?.message?.includes("404");

                if (!is404) {
                    console.error(
                        "[GitLabLoader.createBranch] Unexpected error checking branch existence:",
                        branchCheckError
                    );
                    throw branchCheckError;
                }
                // Branch doesn't exist - continue to creation
                console.log(`[GitLabLoader.createBranch] Branch ${request.branch} doesn't exist, will create it`);
            }

            // Get the latest commit SHA from the base branch
            console.log(`[GitLabLoader.createBranch] Fetching base branch info for: ${request.baseBranch}`);
            const baseBranchInfo = await gitlab.Branches.show(projectId, request.baseBranch);
            const baseSha = baseBranchInfo.commit.id;
            console.log(`[GitLabLoader.createBranch] Base branch SHA: ${baseSha}`);

            // Create the new branch from the base branch SHA
            const branch = await gitlab.Branches.create(projectId, request.branch, baseSha);

            return {
                type: "ok",
                baseSha: branch.commit.id,
                alreadyExists: false
            };
        } catch (error) {
            console.error("Failed to create branch:", error);
            return {
                type: "error",
                error: {
                    type: "OPERATION_FAILED",
                    message: error instanceof Error ? error.message : "Failed to create branch"
                }
            };
        }
    }

    async createPullRequest(request: CreatePullRequestRequest): Promise<CreatePullRequestResult> {
        const gitlab = await this.getGitlab();
        if (!gitlab) {
            return {
                type: "error",
                error: {
                    type: "OPERATION_FAILED",
                    message: "Failed to get GitLab instance"
                }
            };
        }

        try {
            const projectId = this.getProjectId();

            console.log("[GitLabLoader.createPullRequest] Creating MR:", {
                projectId,
                sourceBranch: request.head,
                targetBranch: request.base,
                title: request.title,
                draft: request.draft
            });

            const mergeRequest = await gitlab.MergeRequests.create(
                projectId,
                request.head,
                request.base,
                request.title,
                {
                    description: request.body
                    // draft: request.draft ? "draft" : "open" // TODO: this does not exist on this type
                }
            );

            console.log("[GitLabLoader.createPullRequest] MR created:", {
                iid: mergeRequest.iid,
                url: mergeRequest.web_url
            });

            return {
                type: "ok",
                prNumber: mergeRequest.iid,
                prUrl: mergeRequest.web_url
            };
        } catch (error) {
            console.error("Failed to create merge request:", error);
            return {
                type: "error",
                error: {
                    type: "OPERATION_FAILED",
                    message: error instanceof Error ? error.message : "Failed to create merge request"
                }
            };
        }
    }

    async updatePullRequest(request: UpdatePullRequestRequest): Promise<UpdatePullRequestResult> {
        const gitlab = await this.getGitlab();
        if (!gitlab) {
            return {
                type: "error",
                error: {
                    type: "OPERATION_FAILED",
                    message: "Failed to get GitLab instance"
                }
            };
        }

        try {
            const projectId = this.getProjectId();

            await gitlab.MergeRequests.edit(projectId, request.prNumber, {
                title: request.title,
                description: request.body
            });

            return { type: "ok" };
        } catch (error) {
            console.error("Failed to update merge request:", error);
            return {
                type: "error",
                error: {
                    type: "OPERATION_FAILED",
                    message: error instanceof Error ? error.message : "Failed to update merge request"
                }
            };
        }
    }

    async updatePullRequestStatus(request: UpdatePullRequestStatusRequest): Promise<UpdatePullRequestStatusResult> {
        const gitlab = await this.getGitlab();
        if (!gitlab) {
            return {
                type: "error",
                error: {
                    type: "OPERATION_FAILED",
                    message: "Failed to get GitLab instance"
                }
            };
        }

        try {
            const projectId = this.getProjectId();

            // First, find the MR for the branch
            const mergeRequests = await gitlab.MergeRequests.all({
                projectId,
                sourceBranch: request.branch,
                targetBranch: request.baseBranch,
                state: "opened"
            });

            const mr = mergeRequests[0];

            if (!mr) {
                return {
                    type: "error",
                    error: {
                        type: "RESOURCE_NOT_FOUND",
                        message: "No merge request found for this branch"
                    }
                };
            }

            // Handle status updates
            if (request.status === "draft") {
                // Mark as draft by adding "Draft:" prefix to title if not already present
                let newTitle = mr.title;
                if (!newTitle.startsWith("Draft:") && !newTitle.startsWith("WIP:")) {
                    newTitle = `Draft: ${newTitle}`;
                }
                await gitlab.MergeRequests.edit(projectId, mr.iid, {
                    title: newTitle
                });
                return {
                    type: "ok",
                    status: "draft",
                    prNumber: mr.iid,
                    prUrl: mr.web_url
                };
            } else if (request.status === "open") {
                // Mark as ready for review by removing "Draft:" or "WIP:" prefix from title
                let newTitle = mr.title;
                newTitle = newTitle.replace(/^(Draft:|WIP:)\s*/i, "");
                await gitlab.MergeRequests.edit(projectId, mr.iid, {
                    title: newTitle
                });
                return {
                    type: "ok",
                    status: "open",
                    prNumber: mr.iid,
                    prUrl: mr.web_url
                };
            } else if (request.status === "closed") {
                await gitlab.MergeRequests.edit(projectId, mr.iid, {
                    stateEvent: "close"
                });
                return {
                    type: "ok",
                    status: "open",
                    prNumber: mr.iid,
                    prUrl: mr.web_url
                };
            } else if (request.status === "merged") {
                await gitlab.MergeRequests.accept(projectId, mr.iid);
                return {
                    type: "ok",
                    status: "open",
                    prNumber: mr.iid,
                    prUrl: mr.web_url
                };
            }

            return {
                type: "ok",
                status: "open",
                prNumber: mr.iid,
                prUrl: mr.web_url
            };
        } catch (error) {
            console.error("Failed to update merge request status:", error);
            return {
                type: "error",
                error: {
                    type: "OPERATION_FAILED",
                    message: error instanceof Error ? error.message : "Failed to update merge request status"
                }
            };
        }
    }

    async createRepository(request: CreateRepositoryRequest): Promise<CreateRepositoryResult> {
        const gitlab = await this.getGitlab();
        if (!gitlab) {
            return {
                type: "error",
                error: {
                    type: "OPERATION_FAILED",
                    message: "Failed to get GitLab instance"
                }
            };
        }

        try {
            const project = await gitlab.Projects.create({
                name: request.repoName,
                visibility: request.isPrivate ? "private" : "public",
                initializeWithReadme: false
            });

            const files = request.files || [];
            if (files.length > 0) {
                const actions = files.map(
                    (file) =>
                        ({
                            action: "create",
                            filePath: file.path,
                            content: file.content
                        }) as CommitAction
                );

                await gitlab.Commits.create(project.id, project.default_branch || "main", "Initial commit", actions);
            }

            return {
                type: "ok",
                repoUrl: project.http_url_to_repo,
                htmlUrl: project.web_url
            };
        } catch (error) {
            console.error("Failed to create repository:", error);
            return {
                type: "error",
                error: {
                    type: "OPERATION_FAILED",
                    message: error instanceof Error ? error.message : "Failed to create repository"
                }
            };
        }
    }

    /**
     * Gets MR information for a branch.
     */
    async getPullRequestForBranch(request: GetPullRequestForBranchRequest): Promise<GetPullRequestForBranchResult> {
        const gitlab = await this.getGitlab();
        if (!gitlab) {
            return {
                type: "error",
                error: "Failed to get GitLab client"
            };
        }

        try {
            const projectId = this.getProjectId();

            const mergeRequests = await gitlab.MergeRequests.all({
                projectId,
                sourceBranch: request.branch,
                targetBranch: request.baseBranch,
                state: "opened"
            });

            const mr = mergeRequests[0];

            if (!mr) {
                return {
                    type: "error",
                    error: "No associated merge requests found for this branch"
                };
            }

            if (mergeRequests.length > 1) {
                return {
                    type: "error",
                    error: "Multiple merge requests found for this branch"
                };
            }

            const isDraft = mr.title?.startsWith("Draft:") || mr.title?.startsWith("WIP:");

            return {
                type: "ok",
                title: mr.title,
                prNumber: mr.iid,
                prUrl: mr.web_url,
                status: mr.state,
                draft: isDraft,
                merged: mr.merged_at != null,
                nodeId: undefined
            };
        } catch (error) {
            console.error("Failed to fetch MR for branch", error);
            return {
                type: "error",
                error: error instanceof Error ? error.message : "Unknown error occurred"
            };
        }
    }
}

export function invalidateCommitRefCache(owner: string, repo: string, ref: string): void {
    revalidateTag(`gitlab-commit-ref-${owner}-${repo}-${ref}`, "default");
}

export function invalidateRepoCache(owner: string, repo: string): void {
    revalidateTag(`gitlab-repo-${owner}-${repo}`, "default");
}
