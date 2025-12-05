// Re-export GitLoader types for convenience
export type {
    CreateBranchRequest,
    CreateBranchResult,
    CreateCommitRequest,
    CreateCommitResult,
    CreatePullRequestRequest,
    CreatePullRequestResult,
    CreateRepositoryRequest,
    CreateRepositoryResult,
    GitAccessError,
    GitCommitableFile,
    GitOperationError,
    RepositoryFile,
    UpdatePullRequestRequest,
    UpdatePullRequestResult,
    UpdatePullRequestStatusRequest,
    UpdatePullRequestStatusResult,
    ValidateAccessRequest,
    ValidateAccessResult
} from "@fern-api/docs-loader";

// GitHub-specific file mode type
export type GITHUB_FILE_MODE = "100644" | "100755" | "040000" | "160000" | "120000";

// For backward compatibility
export type { GitCommitableFile as GithubCommitableFile } from "@fern-api/docs-loader";

export type GithubRepo = {
    name: string;
    owner: string;
    url: string;
    avatarUrl: string;
    description: string;
    stargazersCount: number;
    organization: string | undefined;
};

export type GitSourceRepo = {
    gitUrl: string | undefined;
    repoName: string | undefined;
    owner: string | undefined;
    repo: string | undefined;
    baseBranch: string | undefined;
    fernBotHasInstallationId: boolean | undefined;
};

export type GithubPrStatus = "open" | "closed" | "merged" | "draft" | "preview";
