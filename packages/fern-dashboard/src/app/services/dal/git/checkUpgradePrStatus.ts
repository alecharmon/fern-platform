import "server-only";

import { getFernBotOctokitForRepo } from "@/app/services/auth0/fernBotOctokit";
import { getOwnerAndRepoFromGithubUrl } from "@/app/services/github/github";

import { getUpgradePrBranchName } from "./request-utils";

export type UpgradePrStatus = { exists: false } | { exists: true; prUrl: string; prNumber: number };

export async function checkUpgradePrStatus(
    gitUrl: string,
    currentVersion: string,
    latestVersion: string,
    baseBranch: string
): Promise<UpgradePrStatus> {
    const { owner, repo } = getOwnerAndRepoFromGithubUrl(gitUrl);
    if (owner == null || repo == null) {
        return { exists: false };
    }

    try {
        const fernBotResult = await getFernBotOctokitForRepo(owner, repo);
        if (!fernBotResult.ok) {
            return { exists: false };
        }

        const octokit = fernBotResult.octokit;
        const branchName = getUpgradePrBranchName(currentVersion, latestVersion);

        // Check if branch exists
        try {
            await octokit.request("GET /repos/{owner}/{repo}/branches/{branch}", {
                owner,
                repo,
                branch: branchName
            });
        } catch (error: any) {
            if (error?.status === 404) {
                // Branch doesn't exist, so no PR exists
                return { exists: false };
            }
            // Other errors, assume no PR exists
            return { exists: false };
        }

        // Branch exists, check for PR
        try {
            const prs = await octokit.request("GET /repos/{owner}/{repo}/pulls", {
                owner,
                repo,
                head: `${owner}:${branchName}`,
                base: baseBranch,
                state: "open"
            });

            if (prs.data.length > 0 && prs.data[0]) {
                const pr = prs.data[0];
                return {
                    exists: true,
                    prUrl: pr.html_url,
                    prNumber: pr.number
                };
            }
        } catch (error) {
            console.error("Error checking for existing PR:", error);
        }

        return { exists: false };
    } catch (error) {
        console.error("Error checking upgrade PR status:", error);
        return { exists: false };
    }
}
