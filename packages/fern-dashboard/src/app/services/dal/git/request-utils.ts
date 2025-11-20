import { getOwnerAndRepoFromGithubUrl } from "../../github/github";
import type { RepoData, RepoIdentifier } from "./types";

export async function deriveRepoIdentifier({
    gitUrl,
    owner,
    repo
}: {
    gitUrl?: string;
    owner?: string;
    repo?: string;
}): Promise<{ success: true; identifier: RepoIdentifier } | { success: false }> {
    if (gitUrl) {
        return { success: true, identifier: { type: "url", gitUrl } };
    } else if (owner && repo) {
        return { success: true, identifier: { type: "owner-repo", owner, repo } };
    }
    return { success: false };
}

/**
 * Normalizes extracted repo data into a complete RepoData object
 */
export function normalizeRepoData(identifier: RepoIdentifier): RepoData {
    if (identifier.type === "url") {
        const { owner, repo } = getOwnerAndRepoFromGithubUrl(identifier.gitUrl);
        return {
            owner: owner || "",
            repo: repo || "",
            gitUrl: identifier.gitUrl
        };
    }
    return {
        owner: identifier.owner,
        repo: identifier.repo,
        gitUrl: `https://github.com/${identifier.owner}/${identifier.repo}`
    };
}

export function getUpgradePrBranchName(currentVersion: string, latestVersion: string): string {
    return `upgrade-fern-${currentVersion}-to-${latestVersion}`;
}
