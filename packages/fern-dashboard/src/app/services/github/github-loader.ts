import "server-only";

import type {
    ApiSourceType,
    CreateBranchRequest,
    CreateBranchResult,
    CreateCommitRequest,
    CreateCommitResult,
    CreatePullRequestRequest,
    CreatePullRequestResult,
    CreateRepositoryRequest,
    CreateRepositoryResult,
    FernProject,
    FetchableSpecType,
    GeneratorsYmlConfig,
    GetApiSpecsOptions,
    GetApiSpecsResult,
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
import yaml from "js-yaml";
import { revalidateTag, unstable_cache } from "next/cache";

import { parseDocsUrlParam } from "@/utils/parseDocsUrlParam";
import type { DocsUrl } from "@/utils/types";

import { getDemoCreationBotOctokit, getFernBotOctokitForRepo, getGheOctokitForRepo } from "../auth0/fernBotOctokit";
import {
    extractReferencedYmlPaths,
    getOwnerAndRepoFromGithubUrl,
    parseFernConfig,
    parseUrlsFromDocsYml,
    stripAndSanitizeUrl
} from "../git-common";
import type { GITHUB_FILE_MODE } from "./types";

export type GitHubAuthMode = "fern-bot" | "demo-creation-bot" | "ghe";

/**
 * The GitHubLoader is used to read from and write to a remote GitHub repository.
 */
export class GitHubLoader implements GitLoader {
    private getOctokitInstance: () => Promise<Octokit | null>;
    private octokit: Octokit | null = null;
    private owner: string;
    private repo: string;
    private repoUrl: string | null;
    private skipCache: boolean;

    constructor(
        params: string | { githubUrl: string } | { owner: string; repo: string },
        authMode: GitHubAuthMode = "fern-bot",
        skipCache: boolean = false
    ) {
        this.skipCache = skipCache;
        if (typeof params === "string") {
            const parsed = getOwnerAndRepoFromGithubUrl(params);
            this.owner = parsed.owner ?? "";
            this.repo = parsed.repo ?? "";
            this.repoUrl = params;
        } else if ("githubUrl" in params) {
            const parsed = getOwnerAndRepoFromGithubUrl(params.githubUrl);
            this.owner = parsed.owner ?? "";
            this.repo = parsed.repo ?? "";
            this.repoUrl = params.githubUrl;
        } else {
            this.owner = params.owner;
            this.repo = params.repo;
            this.repoUrl = null; // No URL available when using owner/repo directly
        }

        this.getOctokitInstance = async () => {
            if (!this.owner || !this.repo) {
                return null;
            }

            if (authMode === "demo-creation-bot") {
                const result = getDemoCreationBotOctokit();
                return result.ok ? result.octokit : null;
            } else if (authMode === "ghe") {
                if (!this.repoUrl) {
                    console.error("[GitHubLoader] GHE auth mode requires a repo URL, not owner/repo");
                    return null;
                }
                const result = await getGheOctokitForRepo(this.repoUrl, this.owner, this.repo);
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
        // Throw inside the cached function so transient errors are NOT cached by unstable_cache.
        const fetchCommitRef = async () => {
            const octokit = await this.getOctokit();
            if (!octokit) {
                throw new Error(`Failed to get Octokit instance for ${owner}/${repo}`);
            }
            const response = await octokit.request("GET /repos/{owner}/{repo}/commits/{ref}", {
                owner,
                repo,
                ref
            });
            return response.data.sha;
        };

        try {
            if (this.skipCache) {
                return await fetchCommitRef();
            }
            return await unstable_cache(fetchCommitRef, [`github-commit-ref-${owner}-${repo}-${ref}`], {
                revalidate: 60 * 5, // 5 minutes - good for normal browsing, rely on visibility change for freshness
                tags: [`github-commit-ref-${owner}-${repo}-${ref}`, `github-repo-${owner}-${repo}`]
            })();
        } catch (error) {
            console.error(`Failed to resolve commit ref ${ref} from ${owner}/${repo}:`, error);
            return null;
        }
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

        // Throw inside the cached function so transient errors are NOT cached by unstable_cache.
        // Only successful results should be cached (file content at a commit SHA is immutable).
        const fetchFileContent = async () => {
            const octokit = await this.getOctokit();
            if (!octokit) {
                throw new Error(`Failed to get Octokit instance for ${owner}/${repo}`);
            }

            const response = await octokit.request("GET /repos/{owner}/{repo}/contents/{path}", {
                owner,
                repo,
                path,
                ref: commitSha,
                headers: { accept: "application/vnd.github.v3.raw" }
            });

            return response.data as unknown as string;
        };

        const tag = `github-file:${owner}/${repo}:${path}`;

        try {
            if (this.skipCache) {
                return await fetchFileContent();
            }
            return await unstable_cache(fetchFileContent, [`github-file-${owner}-${repo}-${commitSha}-${path}`], {
                revalidate: 60 * 60 * 24, // 24 hours
                tags: [tag]
            })();
        } catch (error) {
            console.error(`Failed to fetch ${path} from ${owner}/${repo}:`, error);
            return null;
        }
    }

    private async getRepository(owner: string, repo: string) {
        const fetchRepository = async () => {
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
        };

        if (this.skipCache) {
            return fetchRepository();
        }

        return unstable_cache(fetchRepository, [`github-repo-${owner}-${repo}`], {
            revalidate: 60 * 60 * 24, // 1 day
            tags: [`github-repo-${owner}-${repo}`]
        })();
    }

    private async getTree(owner: string, repo: string, defaultBranch: string) {
        const fetchTree = async () => {
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
        };

        if (this.skipCache) {
            return fetchTree();
        }

        return unstable_cache(fetchTree, [`github-tree-${owner}-${repo}-${defaultBranch}`], {
            tags: [`github-tree-${owner}-${repo}-${defaultBranch}`]
        })();
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
                allFoundSites.push(...urls);

                if (!firstDocsYmlPath && urls.length > 0) {
                    firstDocsYmlPath = project.docsYmlPath;
                }

                const strippedUrls = urls.map(stripAndSanitizeUrl);
                const strippedSite = stripAndSanitizeUrl(site);

                // Check if any URL matches the site
                if (strippedUrls.includes(strippedSite)) {
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

        const referencedFileContents = await Promise.all(
            referencedPaths.map(async (relativePath) => {
                if (relativePath.startsWith("../")) {
                    throw new Error(
                        `docs.yml does not allow referencing files outside of its directory: ${relativePath}`
                    );
                }
                // Normalize the relative path (remove ./ prefix if present)
                const normalizedPath = relativePath.startsWith("./") ? relativePath.substring(2) : relativePath;
                // Construct absolute path (docs.yml location is considered the root directory)
                const absolutePath = docsYmlDir ? `${docsYmlDir}/${normalizedPath}` : normalizedPath;

                const fileContent = await this.getFileContent(owner, repo, targetRef, absolutePath);
                return {
                    normalizedPath,
                    fileContent,
                    absolutePath
                };
            })
        );

        for (const { normalizedPath, fileContent, absolutePath } of referencedFileContents) {
            if (fileContent) {
                // Store with the relative path as key (normalized)
                docsYmlMap.set(normalizedPath, fileContent);
            } else {
                console.warn(`Failed to load referenced yml file: ${absolutePath}`);
            }
        }

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
     * Fetches API specs from generators.yml, including any referenced files and overrides.
     * Searches for generators.yml in the fern folder and apis/ subdirectories.
     *
     * @param options.fetchTypes - Spec types to fetch file contents for. Defaults to ["openapi"].
     *                             Other types (asyncapi, openrpc) are detected but not fetched unless specified.
     */
    async getApiSpecs(
        owner: string,
        repo: string,
        site: DocsUrl,
        ref: string = "main",
        preferDefaultBranch: boolean = false,
        options: GetApiSpecsOptions = {}
    ): Promise<GetApiSpecsResult> {
        try {
            const { fetchTypes = ["openapi"] } = options;

            // Helper to check if a spec type should be fetched
            const shouldFetch = (type: FetchableSpecType): boolean => fetchTypes.includes(type);

            // 1. Get the fern project to find the fern folder path
            const projectResult = await this.getFernProjectBySite(owner, repo, site);
            if (projectResult.type === "error") {
                return { type: "error", error: projectResult.error };
            }

            const defaultBranch = projectResult.result.defaultBranch;
            const targetRef = preferDefaultBranch ? defaultBranch : ref;

            // Get the fern folder path from docs.yml location
            const docsYmlPath = projectResult.result.project.docsYmlPath;
            const fernFolder = docsYmlPath.substring(0, docsYmlPath.lastIndexOf("/"));

            // 2. Search for generators.yml files - check both the fern folder and apis/ subdirectories
            const generatorsYmlPaths = await this.findGeneratorsYmlFiles(owner, repo, defaultBranch, fernFolder);

            if (generatorsYmlPaths.length === 0) {
                return {
                    type: "error",
                    error: { type: "GENERATORS_YML_MISSING" }
                };
            }

            // 3. Parse generators.yml files and collect specs
            const specs = new Map<string, string>();
            const overrideFilePaths = new Set<string>();
            let detectedSourceType: ApiSourceType = "unknown";
            let primaryGeneratorsYmlPath = generatorsYmlPaths[0] ?? "";
            let primaryGeneratorsYmlContent = "";

            for (const generatorsYmlPath of generatorsYmlPaths) {
                const content = await this.getFileContent(owner, repo, targetRef, generatorsYmlPath);
                if (!content) {
                    continue;
                }

                // Store the content of the first (primary) generators.yml
                if (generatorsYmlPath === primaryGeneratorsYmlPath) {
                    primaryGeneratorsYmlContent = content;
                }

                let generatorsYml: GeneratorsYmlConfig;
                try {
                    generatorsYml = yaml.load(content) as GeneratorsYmlConfig;
                } catch {
                    console.warn(`Failed to parse generators.yml at ${generatorsYmlPath}`);
                    continue;
                }

                // Get the directory containing generators.yml for resolving relative paths
                const generatorsYmlDir = generatorsYmlPath.substring(0, generatorsYmlPath.lastIndexOf("/"));

                // 4. Detect source type and conditionally fetch specs based on fetchTypes
                if (generatorsYml?.api?.specs) {
                    for (const spec of generatorsYml.api.specs) {
                        if (spec.openapi) {
                            detectedSourceType = "openapi";
                            if (shouldFetch("openapi")) {
                                await this.fetchSpecWithRefs(
                                    owner,
                                    repo,
                                    targetRef,
                                    spec.openapi,
                                    generatorsYmlDir,
                                    specs
                                );
                                // Also fetch the overrides file if specified
                                if (spec.overrides) {
                                    const overridesPath = this.resolvePath(generatorsYmlDir, spec.overrides);
                                    const overridesContent = await this.getFileContent(
                                        owner,
                                        repo,
                                        targetRef,
                                        overridesPath
                                    );
                                    if (overridesContent) {
                                        specs.set(overridesPath, overridesContent);
                                        overrideFilePaths.add(overridesPath);
                                    }
                                }
                            }
                        } else if (spec.asyncapi) {
                            if (detectedSourceType === "unknown") {
                                detectedSourceType = "asyncapi";
                            }
                            if (shouldFetch("asyncapi")) {
                                // AsyncAPI uses the same $ref format as OpenAPI
                                await this.fetchSpecWithRefs(
                                    owner,
                                    repo,
                                    targetRef,
                                    spec.asyncapi,
                                    generatorsYmlDir,
                                    specs
                                );
                                if (spec.overrides) {
                                    const overridesPath = this.resolvePath(generatorsYmlDir, spec.overrides);
                                    const overridesContent = await this.getFileContent(
                                        owner,
                                        repo,
                                        targetRef,
                                        overridesPath
                                    );
                                    if (overridesContent) {
                                        specs.set(overridesPath, overridesContent);
                                        overrideFilePaths.add(overridesPath);
                                    }
                                }
                            }
                        } else if (spec.openrpc) {
                            if (detectedSourceType === "unknown") {
                                detectedSourceType = "openrpc";
                            }
                            if (shouldFetch("openrpc")) {
                                // OpenRPC uses JSON Schema $ref format
                                await this.fetchSpecWithRefs(
                                    owner,
                                    repo,
                                    targetRef,
                                    spec.openrpc,
                                    generatorsYmlDir,
                                    specs
                                );
                                if (spec.overrides) {
                                    const overridesPath = this.resolvePath(generatorsYmlDir, spec.overrides);
                                    const overridesContent = await this.getFileContent(
                                        owner,
                                        repo,
                                        targetRef,
                                        overridesPath
                                    );
                                    if (overridesContent) {
                                        specs.set(overridesPath, overridesContent);
                                        overrideFilePaths.add(overridesPath);
                                    }
                                }
                            }
                        } else if (spec.proto) {
                            // TODO: Proto/gRPC support - detection only, file loading not supported
                            if (detectedSourceType === "unknown") {
                                detectedSourceType = "proto";
                            }
                        }
                    }
                }

                // TODO: Fern Definition support - detection only, file loading not supported
                if (!generatorsYml?.api?.specs && detectedSourceType === "unknown") {
                    const definitionPath = `${generatorsYmlDir}/definition`;
                    const definitionExists = await this.getFileContent(
                        owner,
                        repo,
                        targetRef,
                        `${definitionPath}/api.yml`
                    );
                    if (definitionExists) {
                        detectedSourceType = "fern-definition";
                    }
                }

                // 5. Fetch openapi-overrides if present (only when fetching openapi)
                if (shouldFetch("openapi") && generatorsYml?.["openapi-overrides"]) {
                    const overridesPath = this.resolvePath(generatorsYmlDir, generatorsYml["openapi-overrides"]);
                    const overridesContent = await this.getFileContent(owner, repo, targetRef, overridesPath);
                    if (overridesContent) {
                        const relativePath = overridesPath.startsWith(fernFolder + "/")
                            ? overridesPath.substring(fernFolder.length + 1)
                            : overridesPath;
                        specs.set(relativePath, overridesContent);
                        overrideFilePaths.add(relativePath);
                    }
                }
            }

            if (specs.size === 0 && detectedSourceType === "unknown") {
                return {
                    type: "error",
                    error: { type: "NO_API_SPECS" }
                };
            }

            return {
                type: "ok",
                result: {
                    specs,
                    sourceType: detectedSourceType,
                    overrideFilePaths,
                    generatorsYmlPath: primaryGeneratorsYmlPath,
                    generatorsYmlContent: primaryGeneratorsYmlContent
                }
            };
        } catch (error) {
            console.error("[getApiSpecs] An unexpected error occurred:", error);
            return {
                type: "error",
                error: { type: "UNEXPECTED_ERROR" }
            };
        }
    }

    /**
     * Finds all generators.yml files in the fern folder and apis/ subdirectories.
     */
    private async findGeneratorsYmlFiles(
        owner: string,
        repo: string,
        ref: string,
        fernFolder: string
    ): Promise<string[]> {
        const paths: string[] = [];

        // Check for generators.yml in the fern folder root
        const rootGeneratorsYml = `${fernFolder}/generators.yml`;
        const rootContent = await this.getFileContent(owner, repo, ref, rootGeneratorsYml);
        if (rootContent) {
            paths.push(rootGeneratorsYml);
        }

        // Search for generators.yml in apis/ subdirectories using the tree API
        try {
            const treeResponse = await this.getTree(owner, repo, ref);
            const apisPrefix = `${fernFolder}/apis/`;

            for (const item of treeResponse.data.tree) {
                if (
                    item.type === "blob" &&
                    item.path?.startsWith(apisPrefix) &&
                    item.path?.endsWith("/generators.yml")
                ) {
                    paths.push(item.path);
                }
            }
        } catch (error) {
            console.warn("Failed to search for generators.yml in apis/ subdirectories:", error);
        }

        return paths;
    }

    /**
     * Fetches an API spec file and recursively fetches any external $ref dependencies.
     * Works for OpenAPI and AsyncAPI specs which share the same $ref format.
     */
    private async fetchSpecWithRefs(
        owner: string,
        repo: string,
        ref: string,
        specPath: string,
        baseDir: string,
        specs: Map<string, string>,
        visited: Set<string> = new Set()
    ): Promise<void> {
        const fullPath = this.resolvePath(baseDir, specPath);
        if (visited.has(fullPath)) {
            return;
        }
        visited.add(fullPath);

        const content = await this.getFileContent(owner, repo, ref, fullPath);
        if (!content) {
            console.warn(`Failed to fetch spec: ${fullPath}`);
            return;
        }

        // Store with the full path as key
        specs.set(fullPath, content);

        // Parse for external $ref and recursively fetch
        const externalRefs = this.extractExternalRefs(content);
        const specDir = fullPath.substring(0, fullPath.lastIndexOf("/"));

        for (const refPath of externalRefs) {
            await this.fetchSpecWithRefs(owner, repo, ref, refPath, specDir, specs, visited);
        }
    }

    /**
     * Extracts external file $ref paths from OpenAPI spec content.
     * Only returns external file references (not internal #/... refs).
     */
    private extractExternalRefs(content: string): string[] {
        const refs: string[] = [];

        try {
            // Try parsing as YAML first (also works for JSON)
            const parsed = yaml.load(content);
            this.walkForRefs(parsed, refs);
        } catch {
            // If YAML parsing fails, try JSON
            try {
                const parsed = JSON.parse(content);
                this.walkForRefs(parsed, refs);
            } catch {
                // If both fail, return empty array
                console.warn("Failed to parse OpenAPI spec for $ref extraction");
            }
        }

        return refs;
    }

    /**
     * Recursively walks an object to find $ref values.
     */
    private walkForRefs(obj: unknown, refs: string[]): void {
        if (!obj || typeof obj !== "object") {
            return;
        }

        if (Array.isArray(obj)) {
            for (const item of obj) {
                this.walkForRefs(item, refs);
            }
            return;
        }

        const record = obj as Record<string, unknown>;

        // Check for $ref property
        if (typeof record.$ref === "string") {
            const refValue = record.$ref;
            // External ref if it doesn't start with #
            if (!refValue.startsWith("#")) {
                // Extract file path (before any # anchor)
                const filePath = refValue.split("#")[0];
                if (filePath && !refs.includes(filePath)) {
                    refs.push(filePath);
                }
            }
        }

        // Recursively check all properties
        for (const value of Object.values(record)) {
            this.walkForRefs(value, refs);
        }
    }

    /**
     * Resolves a relative path against a base directory.
     */
    private resolvePath(baseDir: string, relativePath: string): string {
        // Remove leading ./ if present
        const normalizedPath = relativePath.startsWith("./") ? relativePath.substring(2) : relativePath;

        // If it's an absolute path (starts with /), return as-is (without leading /)
        if (normalizedPath.startsWith("/")) {
            return normalizedPath.substring(1);
        }

        // Handle ../ by going up directories
        const baseParts = baseDir.split("/").filter(Boolean);
        const pathParts = normalizedPath.split("/");

        for (const part of pathParts) {
            if (part === "..") {
                baseParts.pop();
            } else if (part !== ".") {
                baseParts.push(part);
            }
        }

        return baseParts.join("/");
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

            // For binary files, create blobs separately to ensure proper encoding
            const binaryFilesToCreate = request.files.filter(
                (
                    f
                ): f is {
                    path: string;
                    content: string;
                    encoding: "base64";
                    delete?: false;
                } => !f.delete && f.encoding === "base64"
            );
            const blobShaMap = new Map<string, string>();

            if (binaryFilesToCreate.length > 0) {
                for (const file of binaryFilesToCreate) {
                    const blobResponse = await octokit.request("POST /repos/{owner}/{repo}/git/blobs", {
                        owner: request.owner,
                        repo: request.repo,
                        content: file.content,
                        encoding: "base64"
                    });
                    blobShaMap.set(file.path, blobResponse.data.sha);
                }
            }

            // Create the tree with file changes
            const tree = request.files
                .map((file) => {
                    if (file.delete) {
                        // Only include deletion entries for files that actually exist
                        if (!existingFiles.has(file.path)) {
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

                        const blobSha = blobShaMap.get(file.path);

                        if (blobSha) {
                            // Binary file - reference the blob by SHA
                            return {
                                path: file.path,
                                mode: "100644" as GITHUB_FILE_MODE,
                                type: "blob" as const,
                                sha: blobSha
                            };
                        } else {
                            // Text file - include content directly
                            return {
                                path: file.path,
                                mode: "100644" as GITHUB_FILE_MODE,
                                type: "blob" as const,
                                content: file.content
                            };
                        }
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
            let repoUrl: string;
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

                repoUrl = createRepoResponse.data.clone_url;
                htmlUrl = createRepoResponse.data.html_url;

                if (!repoUrl || !htmlUrl) {
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
                } catch {
                    retries--;
                    if (retries === 0) {
                        throw new Error("Repository initialization timeout");
                    }
                }
            }

            // For binary files, create blobs separately to ensure proper encoding
            const binaryFiles = request.files.filter((f) => f.encoding === "base64");
            const blobShaMap = new Map<string, string>();

            if (binaryFiles.length > 0) {
                for (const file of binaryFiles) {
                    const blobResponse = await octokit.request("POST /repos/{owner}/{repo}/git/blobs", {
                        owner: request.owner,
                        repo: request.repoName,
                        content: file.content,
                        encoding: "base64"
                    });
                    blobShaMap.set(file.path, blobResponse.data.sha);
                }
            }

            // Create tree with files - use SHA for binary files, content for text files
            const tree = request.files.map((file) => {
                const blobSha = blobShaMap.get(file.path);

                if (blobSha) {
                    // Binary file - reference the blob by SHA
                    return {
                        path: file.path,
                        mode: "100644" as GITHUB_FILE_MODE,
                        type: "blob" as const,
                        sha: blobSha
                    };
                } else {
                    // Text file - include content directly
                    return {
                        path: file.path,
                        mode: "100644" as GITHUB_FILE_MODE,
                        type: "blob" as const,
                        content: file.content
                    };
                }
            });

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
                    repoUrl,
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
