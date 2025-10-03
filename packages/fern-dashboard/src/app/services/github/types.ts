export type GITHUB_FILE_MODE = "100644" | "100755" | "040000" | "160000" | "120000";
export type GithubCommitableFile =
    | {
          path: string;
          delete: true;
          mode?: GITHUB_FILE_MODE;
      }
    | {
          path: string;
          content: string;
          mode?: GITHUB_FILE_MODE;
          delete?: false;
      };

export type GithubRepo = {
    name: string;
    owner: string;
    url: string;
    avatarUrl: string;
    description: string;
    stargazersCount: number;
    organization: string | undefined;
};

export type GithubSourceRepo = {
    githubUrl: string | undefined;
    repoName: string | undefined;
    owner: string | undefined;
    repo: string | undefined;
    baseBranch: string | undefined;
    fernBotHasInstallationId: boolean | undefined;
};

export type GithubPrStatus = "open" | "closed" | "merged" | "draft";
