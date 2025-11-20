import { getFernBotOctokitForRepo } from "@/app/services/auth0/fernBotOctokit";

export type ValidateGithubBranchResponse = {
    exists: boolean;
    error?: string;
};

export default async function validateGithubBranchHandler({
    owner,
    repo,
    branchName
}: {
    owner: string;
    repo: string;
    branchName: string;
}): Promise<ValidateGithubBranchResponse> {
    const octokitResult = await getFernBotOctokitForRepo(owner, repo);
    if (!octokitResult.ok) {
        throw new Error(`Failed to get Octokit instance: ${octokitResult.error.type}`);
    }

    const octokit = octokitResult.octokit;

    if (!owner || !repo) {
        return {
            exists: false,
            error: "Owner and repo are required"
        };
    }

    try {
        // Use Octokit to check if the branch exists
        await octokit.request("GET /repos/{owner}/{repo}/branches/{branch}", {
            owner,
            repo,
            branch: branchName
        });

        // If we get here, the branch exists
        return {
            exists: true
        };
    } catch (error: any) {
        // If the branch doesn't exist, GitHub returns a 404
        if (error.status === 404) {
            return {
                exists: false
            };
        }

        // For other errors (like permission issues, network problems, etc.)
        console.error("Failed to check branch existence", error);
        return {
            exists: false,
            error: "Failed to check branch existence"
        };
    }
}
