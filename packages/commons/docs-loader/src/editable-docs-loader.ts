import type { DocsLoader } from "@fern-api/docs-server/docs-loader";
import type { HttpMethod } from "@fern-api/docs-utils";
import type { DocsV1Read } from "@fern-api/fdr-sdk";
import type { EndpointId, PruningNodeType } from "@fern-api/fdr-sdk/api-definition";

import { createCachedDocsLoader, encodeDocsLoaderDomain } from "./readonly-docs-loader";

/**
 * The EditableDocsLoader combines a read-only docs loader with a git loader.
 * The read-only docs loader is used to get docs metadata.
 * The git loader is used to get files from a remote git repository.
 */
class EditableDocsLoader implements DocsLoader {
    private readOnlyDocsLoader: DocsLoader;
    domain: string;
    fern_token: string | undefined;

    constructor(docsLoader: DocsLoader) {
        this.readOnlyDocsLoader = docsLoader;
        this.domain = docsLoader.domain;
        this.fern_token = docsLoader.fern_token;
    }

    getAuthConfig = () => this.readOnlyDocsLoader.getAuthConfig();

    getMetadata = () => this.readOnlyDocsLoader.getMetadata();

    getFiles = () => this.readOnlyDocsLoader.getFiles();

    getMdxBundlerFiles = () => this.readOnlyDocsLoader.getMdxBundlerFiles();

    getPrunedApi = (id: string, ...nodes: PruningNodeType[]) => this.readOnlyDocsLoader.getPrunedApi(id, ...nodes);

    getEndpointById = (apiDefinitionId: string, endpointId: EndpointId) =>
        this.readOnlyDocsLoader.getEndpointById(apiDefinitionId, endpointId);

    getEndpointByLocator = (method: HttpMethod, path: string, example?: string) =>
        this.readOnlyDocsLoader.getEndpointByLocator(method, path, example);

    getWebhookByLocator = (webhookId: string) => this.readOnlyDocsLoader.getWebhookByLocator(webhookId);

    getRoot = () => this.readOnlyDocsLoader.getRoot();

    getNavigationNode = (id: string) => this.readOnlyDocsLoader.getNavigationNode(id);

    unsafe_getFullRoot = () => this.readOnlyDocsLoader.unsafe_getFullRoot();

    getConfig = (): Promise<Omit<DocsV1Read.DocsDefinition["config"], "navigation" | "root">> =>
        this.readOnlyDocsLoader.getConfig();

    async getPage(pageId: string): Promise<{
        filename: string;
        markdown: string;
        editThisPageUrl?: string;
        css?: any;
        rawMarkdown?: string;
    }> {
        return this.readOnlyDocsLoader.getPage(pageId);
    }

    getColors = () => this.readOnlyDocsLoader.getColors();

    getLogoUrls = () => this.readOnlyDocsLoader.getLogoUrls();

    getFonts = () => this.readOnlyDocsLoader.getFonts();

    getLayout = () => this.readOnlyDocsLoader.getLayout();

    getSettings = () => this.readOnlyDocsLoader.getSettings();

    getTheme = () => this.readOnlyDocsLoader.getTheme();

    getLanguage = () => this.readOnlyDocsLoader.getLanguage();

    getAuthState = (pathname?: string) => this.readOnlyDocsLoader.getAuthState(pathname);

    getEdgeFlags = () => this.readOnlyDocsLoader.getEdgeFlags();

    getBaseUrl = () => this.readOnlyDocsLoader.getBaseUrl();

    getDynamicIr = (apiName: string) => this.readOnlyDocsLoader.getDynamicIr(apiName);

    getTypes = () => this.readOnlyDocsLoader.getTypes();
}

interface GetFernProjectSuccess {
    type: "ok";
    result: {
        defaultBranch: string;
        project: FernProject;
    };
}

type GetFernProjectErrors =
    | { type: "REPO_NOT_FOUND" }
    | {
          type: "SITE_NOT_FOUND";
          searchedSite: string;
          foundSites: string[];
          docsYmlPath?: string;
          defaultBranch?: string;
      }
    | { type: "MULTIPLE_PROJECTS_WITH_SITE" }
    | { type: "NO_PROJECTS" };

interface GetFernProjectError {
    type: "error";
    error: GetFernProjectErrors;
}

export type GetFernProjectResult = GetFernProjectSuccess | GetFernProjectError;

type DocsYmlErrors = GetFernProjectErrors | { type: "DOCS_YML_MISSING" };

interface DocsYmlError {
    type: "error";
    error: DocsYmlErrors;
}

interface GetDocsYmlSuccess {
    type: "ok";
    result: string;
    metadata: {
        path: string;
        defaultBranch: string;
    };
}

export type GetDocsYmlResult = GetDocsYmlSuccess | DocsYmlError;

interface GetDocsYmlAndReferencesSuccess {
    type: "ok";
    result: Map<string, string>;
    metadata: {
        /** Path to the fern folder (e.g., "fern" or "some/path/fern") */
        fernFolderPath: string;
    };
}

export type GetDocsYmlAndReferencesResult = GetDocsYmlAndReferencesSuccess | DocsYmlError;

export type FernConfigJsonErrors =
    | GetFernProjectErrors
    | { type: "FERN_CONFIG_JSON_MALFORMED"; parsingErrorMessage: string }
    | { type: "FERN_CONFIG_JSON_MISSING" };

interface FernConfigJsonStructure {
    organization: string;
    version: string;
}

interface FernConfigJsonSuccess {
    type: "ok";
    result: FernConfigJsonStructure & {
        pathToFernConfigJson: string;
    };
}

interface FernConfigJsonError {
    type: "error";
    error: FernConfigJsonErrors;
}

export type GetFernConfigJsonResult = FernConfigJsonSuccess | FernConfigJsonError;

export interface FernProject {
    docsYmlPath: string;
    fernConfigJsonPath: string;
}

/**
 * The GitLoader is used to get docs.yml and other files from a remote git repository,
 * as well as perform write operations like creating commits, branches, and pull requests.
 */
export interface GitLoader {
    // Read operations
    getFernProjectBySite(owner: string, repo: string, site: string): Promise<GetFernProjectResult>;
    getDocsYml(owner: string, repo: string, site: string, ref?: string): Promise<GetDocsYmlResult>;
    getDocsYmlAndReferences(
        owner: string,
        repo: string,
        site: string,
        ref?: string,
        preferDefaultBranch?: boolean
    ): Promise<GetDocsYmlAndReferencesResult>;
    getFernConfigJson(owner: string, repo: string, site: string): Promise<GetFernConfigJsonResult>;

    // Authorization
    validateAccess(request: ValidateAccessRequest): Promise<ValidateAccessResult>;

    // Write operations
    createCommit?(request: CreateCommitRequest): Promise<CreateCommitResult>;
    createBranch?(request: CreateBranchRequest): Promise<CreateBranchResult>;
    createPullRequest?(request: CreatePullRequestRequest): Promise<CreatePullRequestResult>;
    updatePullRequest?(request: UpdatePullRequestRequest): Promise<UpdatePullRequestResult>;
    updatePullRequestStatus?(request: UpdatePullRequestStatusRequest): Promise<UpdatePullRequestStatusResult>;
    createRepository?(request: CreateRepositoryRequest): Promise<CreateRepositoryResult>;
    getPullRequestForBranch?(request: GetPullRequestForBranchRequest): Promise<GetPullRequestForBranchResult>;
}

// Authorization types
export interface ValidateAccessRequest {
    owner: string;
    repo: string;
    site: string;
    orgName: string;
}

export type ValidateAccessResult = { type: "ok" } | { type: "error"; error: GitAccessError };

export type GitAccessError =
    | { type: "BOT_NOT_INSTALLED"; owner: string; repo: string }
    | { type: "CONFIG_ORG_MISMATCH"; expected: string; actual: string }
    | { type: "CONFIG_MISSING" }
    | { type: "CONFIG_MALFORMED"; message: string }
    | { type: "UNEXPECTED_ERROR"; message: string };

// Write operation request types
export interface CreateCommitRequest {
    owner: string;
    repo: string;
    branch: string;
    message: string;
    files: GitCommitableFile[];
}

export interface CreateBranchRequest {
    owner: string;
    repo: string;
    branch: string;
    baseBranch: string;
}

export interface CreatePullRequestRequest {
    owner: string;
    repo: string;
    head: string;
    base: string;
    title: string;
    body?: string;
    draft?: boolean;
}

export interface UpdatePullRequestRequest {
    owner: string;
    repo: string;
    prNumber: number;
    title?: string;
    body?: string;
}

export interface UpdatePullRequestStatusRequest {
    owner: string;
    repo: string;
    branch: string;
    status: "open" | "draft";
    baseBranch?: string;
}

export interface CreateRepositoryRequest {
    owner: string;
    repoName: string;
    description?: string;
    isPrivate?: boolean;
    files: RepositoryFile[];
}

export interface RepositoryFile {
    path: string;
    content: string;
    /** Encoding of the content. Use "base64" for binary files, or omit for UTF-8 text. */
    encoding?: "utf-8" | "base64";
}

export type GitCommitableFile =
    | { path: string; delete: true }
    | { path: string; content: string; encoding?: "utf-8" | "base64"; delete?: false };

// Write operation result types
export type GitOperationError =
    | { type: "OPERATION_FAILED"; message: string }
    | { type: "RESOURCE_NOT_FOUND"; message: string }
    | { type: "RESOURCE_ALREADY_EXISTS"; message: string }
    | { type: "UNKNOWN_ERROR"; message: string };

export type CreateCommitResult = { type: "ok"; commitSha: string } | { type: "error"; error: GitOperationError };

export type CreateBranchResult =
    | { type: "ok"; baseSha: string; alreadyExists: boolean }
    | { type: "error"; error: GitOperationError };

export type CreatePullRequestResult =
    | { type: "ok"; prUrl: string; prNumber: number }
    | { type: "error"; error: GitOperationError };

export type UpdatePullRequestResult = { type: "ok" } | { type: "error"; error: GitOperationError };

export type UpdatePullRequestStatusResult =
    | { type: "ok"; status: "open" | "draft"; prNumber: number; prUrl: string }
    | { type: "error"; error: GitOperationError };

export type CreateRepositoryResult =
    | { type: "ok"; repoUrl: string; htmlUrl: string }
    | { type: "error"; error: GitOperationError };

export interface GetPullRequestForBranchRequest {
    owner: string;
    repo: string;
    branch: string;
    baseBranch?: string;
}

export type GetPullRequestForBranchResult =
    | {
          type: "ok";
          title: string;
          prNumber: number;
          prUrl: string;
          status: string;
          draft: boolean;
          merged: boolean;
          nodeId?: string;
      }
    | { type: "error"; error: string };

export const createEditableDocsLoader = async ({
    host,
    encodedDocsUrl,
    fernToken,
    forceRevalidate,
    branchName
}: {
    host: string;
    encodedDocsUrl: string;
    fernToken?: string;
    forceRevalidate?: boolean;
    branchName?: string;
}) => {
    const decodedUrl = decodeURIComponent(encodedDocsUrl);
    // Strip any paths off the domain (e.g., "domain.com/subpath" -> "domain.com")
    let domain: string;
    try {
        const url = new URL(decodedUrl.startsWith("http") ? decodedUrl : `https://${decodedUrl}`);
        domain = url.hostname;
    } catch {
        // Fallback: if URL parsing fails, split by '/' and take the first part
        domain = decodedUrl.split("/")[0] || decodedUrl;
    }
    const docsLoader = await createCachedDocsLoader(host, encodeDocsLoaderDomain(domain, branchName), fernToken, {
        returnRawMarkdown: true,
        cacheConfig: {
            cacheKeySuffix: "editable",
            forceRevalidate
        },
        skipAuth: true
    });

    return new EditableDocsLoader(docsLoader);
};
