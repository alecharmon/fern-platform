import "server-only";

import type {
    FernProject,
    GetDocsYmlAndReferencesResult,
    GetDocsYmlResult,
    GetFernConfigJsonResult,
    GetFernProjectResult,
    GitLoader
} from "@fern-api/docs-loader";
import type { Octokit } from "@octokit/core";
import yaml from "js-yaml";
import { unstable_cache } from "next/cache";
import pLimit from "p-limit";
import z from "zod";

import { getFernBotOctokitForRepo } from "../auth0/fernBotOctokit";
import { getOwnerAndRepoFromGithubUrl } from "./github";

// Types and interfaces
interface DocsYmlConfig {
    instances?: {
        url: string;
        ["custom-domain"]?: string;
    }[];
    products?: {
        path?: string;
        [key: string]: any;
    }[];
    versions?: {
        path?: string;
        [key: string]: any;
    }[];
}

/**
 * The GitHubLoader is used to get files from a remote GitHub repository.
 */
export class GitHubLoader implements GitLoader {
    private getOctokitInstance: () => Promise<Octokit | null>;
    private octokit: Octokit | null = null;
    private inFlightRequests: Map<string, Promise<any>> = new Map<string, Promise<any>>();
    private concurrencyLimit = pLimit(8); // Bounded concurrency for parallel file fetching

    constructor(githubUrl: string) {
        this.getOctokitInstance = async () => {
            const { owner, repo } = getOwnerAndRepoFromGithubUrl(githubUrl);
            if (!owner || !repo) {
                return null;
            }

            const result = await getFernBotOctokitForRepo(owner, repo);
            return result.ok ? result.octokit : null;
        };
    }

    private async deduplicateRequest<T>(key: string, fn: () => Promise<T>): Promise<T> {
        const existing = this.inFlightRequests.get(key);
        if (existing) {
            return existing;
        }

        const promise = fn().finally(() => {
            this.inFlightRequests.delete(key);
        });

        this.inFlightRequests.set(key, promise);
        return promise;
    }

    async getOctokit() {
        if (this.octokit == null) {
            this.octokit = await this.getOctokitInstance();
        }
        return this.octokit;
    }

    /**
     * Helper function to resolve a ref to a commit SHA for stable caching.
     */
    private async resolveRefToSha(owner: string, repo: string, ref: string): Promise<string | null> {
        const cacheKey = `github-ref-${owner}-${repo}-${ref}`;

        return this.deduplicateRequest(cacheKey, async () => {
            try {
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
            } catch (error) {
                console.error(`Failed to resolve ref ${ref} from ${owner}/${repo}:`, error);
                return null;
            }
        });
    }

    /**
     * Helper function to get the content of a file from a GitHub repository.
     *
     * Optimizations implemented:
     * 1. Fetches raw content directly (Accept: application/vnd.github.v3.raw) - no base64 decoding
     * 2. Uses bounded concurrency (p-limit) for parallel fetching
     * 3. Aggressive caching with Next.js unstable_cache, ETags, and commit SHA for stable cache keys
     */
    private async getFileContent(owner: string, repo: string, ref: string, path: string): Promise<string | null> {
        const commitSha = await this.resolveRefToSha(owner, repo, ref);
        if (!commitSha) {
            console.error(`Failed to resolve ref ${ref} to commit SHA`);
            return null;
        }

        const cacheKey = `github-file-${owner}-${repo}-${commitSha}-${path}`;
        const tag = `github-file:${owner}/${repo}:${path}`;

        return this.deduplicateRequest(cacheKey, async () => {
            return this.concurrencyLimit(async () => {
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
            });
        });
    }

    /**
     * Parses a docs.yml YAML content and extracts the list of URLs from the instances section
     */
    private parseUrlsFromDocsYml(yamlContent: string): string[] {
        try {
            const config = yaml.load(yamlContent) as DocsYmlConfig;
            if (!config?.instances || !Array.isArray(config.instances)) {
                return [];
            }

            return config.instances
                .filter(
                    (instance): instance is { url: string } =>
                        typeof instance === "object" &&
                        instance != null &&
                        "url" in instance &&
                        typeof instance.url === "string"
                )
                .flatMap((instance) => {
                    if ("custom-domain" in instance && typeof instance["custom-domain"] === "string") {
                        return [instance.url, instance["custom-domain"]];
                    }

                    return [instance.url];
                });
        } catch (error) {
            console.error("Failed to parse YAML content:", error);
            return [];
        }
    }

    /**
     * Extracts all referenced yml file paths from products and versions
     */
    private extractReferencedYmlPaths(yamlContent: string): string[] {
        try {
            const config = yaml.load(yamlContent) as DocsYmlConfig;
            const paths: string[] = [];

            // Extract paths from products
            if (config?.products && Array.isArray(config.products)) {
                for (const product of config.products) {
                    if (product?.path && typeof product.path === "string") {
                        paths.push(product.path);
                    }
                }
            }

            // Extract paths from versions
            if (config?.versions && Array.isArray(config.versions)) {
                for (const version of config.versions) {
                    if (version?.path && typeof version.path === "string") {
                        paths.push(version.path);
                    }
                }
            }

            return paths;
        } catch (error) {
            console.error("Failed to parse YAML content for file references:", error);
            return [];
        }
    }

    private async getRepository(owner: string, repo: string) {
        const cacheKey = `github-repo-${owner}-${repo}`;

        return this.deduplicateRequest(cacheKey, async () => {
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
                if (error?.status === 404) {
                    return null;
                }

                throw error;
            }
        });
    }
    /**
     * Finds a Fern project by site URL using tree searching methodology.
     * Returns the paths to both docs.yml and fern.config.json for the matching project.
     */
    async getFernProjectBySite(owner: string, repo: string, site: string): Promise<GetFernProjectResult> {
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

        const cacheKey = `github-tree-${owner}-${repo}-${defaultBranch}`;
        const treeResponse = await this.deduplicateRequest(cacheKey, async () => {
            return await octokit.request("GET /repos/{owner}/{repo}/git/trees/{tree_sha}", {
                owner,
                repo,
                tree_sha: defaultBranch,
                recursive: "true"
            });
        });

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
                const urls = this.parseUrlsFromDocsYml(docsYmlContent);
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
        site: string,
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
        site: string,
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
        const referencedPaths = this.extractReferencedYmlPaths(mainDocsYmlContent.result);

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

    async getFernConfigJson(owner: string, repo: string, site: string): Promise<GetFernConfigJsonResult> {
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

        let parsedContent: object;
        try {
            parsedContent = JSON.parse(content);
        } catch (error) {
            return {
                type: "error",
                error: {
                    type: "FERN_CONFIG_JSON_MALFORMED",
                    parsingErrorMessage: error instanceof Error ? error.message : String(error)
                }
            };
        }

        const maybeConfig = fernConfigSchema.safeParse(parsedContent);
        if (!maybeConfig.success) {
            return {
                type: "error",
                error: {
                    type: "FERN_CONFIG_JSON_MALFORMED",
                    parsingErrorMessage: maybeConfig.error.message
                }
            };
        }

        return {
            type: "ok",
            result: {
                ...maybeConfig.data,
                pathToFernConfigJson
            }
        };
    }
}

const fernConfigSchema = z.object({
    organization: z.string(),
    version: z.string()
});

/**
 * Strips protocol prefix and normalizes URL for comparison by removing protocol,
 * converting to lowercase, and sanitizing to keep only safe URL characters.
 */
function stripAndSanitizeUrl(str: string): string {
    // Remove http:// or https:// (case-insensitive), lowercase, then allow only specific characters
    const withoutProtocol = str.replace(/^https?:\/\//i, "");
    const lowercased = withoutProtocol.toLowerCase();
    return lowercased.replace(/[^a-z0-9\s\-_.,!?@#$%^&*()+=[\]{};:'"<>/\\|`~%]/g, "");
}
