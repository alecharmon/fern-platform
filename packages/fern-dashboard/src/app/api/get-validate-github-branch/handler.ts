import { getFernBotOctokitForRepo } from "@/app/services/auth0/fernBotOctokit";
import { parseGitUrl } from "@/app/services/git-common/url-utils";
import { getGitLoader } from "@/app/services/github/getGitLoader";
import type { GitLabLoader } from "@/app/services/gitlab/gitlab-loader";

export type ValidateGithubBranchResponse = {
    exists: boolean;
    error?: string;
};

export default async function validateGithubBranchHandler({
    owner,
    repo,
    branchName,
    repoUrl
}: {
    owner: string;
    repo: string;
    branchName: string;
    repoUrl?: string;
}): Promise<ValidateGithubBranchResponse> {
    const url = repoUrl || `https://github.com/${owner}/${repo}`;
    const parsed = parseGitUrl(url);
    const loader = await getGitLoader(url);

    if (!owner || !repo) {
        return {
            exists: false,
            error: "Owner and repo are required"
        };
    }

    try {
        if (parsed.provider === "github") {
            // Use Octokit for GitHub
            const octokitResult = await getFernBotOctokitForRepo(owner, repo);
            if (!octokitResult.ok) {
                return { exists: false, error: "Failed to get GitHub client" };
            }

            const octokit = octokitResult.octokit;
            await octokit.request("GET /repos/{owner}/{repo}/branches/{branch}", {
                owner,
                repo,
                branch: branchName
            });

            return { exists: true };
        } else if (parsed.provider === "gitlab") {
            // Use GitLab API for GitLab
            const gitlabLoader = loader as GitLabLoader;
            const gitlab = await (gitlabLoader as any).getGitlab();
            if (!gitlab) {
                return { exists: false, error: "Failed to get GitLab client" };
            }

            const projectId = `${owner}/${repo}`;
            await gitlab.Branches.show(projectId, branchName);

            return { exists: true };
        } else {
            return { exists: false, error: "Unsupported repository provider" };
        }
    } catch (error: any) {
        // If the branch doesn't exist, both GitHub and GitLab return a 404
        if (error.status === 404 || error?.cause?.response?.statusCode === 404) {
            return { exists: false };
        }

        // For other errors (like permission issues, network problems, etc.)
        console.error("Failed to check branch existence", error);
        return {
            exists: false,
            error: "Failed to check branch existence"
        };
    }
}
