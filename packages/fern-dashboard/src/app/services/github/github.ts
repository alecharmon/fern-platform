import type { Auth0OrgName } from "../auth0/types";
import { DashboardApiClient } from "../dashboard-api/client";
import { parseGitUrl } from "../git-common/url-utils";

export const DEFAULT_PR_TITLE = "Fern Editor: Update";
export const DEFAULT_COMMIT_MESSAGE = "Fern Editor: Update";

export async function handleCreatePr({
    orgName,
    branch,
    owner,
    site,
    repo,
    baseBranch,
    title,
    onAiGenerationComplete,
    gitUrl
}: {
    orgName: Auth0OrgName;
    branch: string;
    owner: string;
    site: string;
    repo: string;
    baseBranch: string;
    title?: string;
    onAiGenerationComplete?: () => void;
    gitUrl?: string;
}): Promise<string | undefined> {
    try {
        console.log("[handleCreatePr] Creating PR/MR with params:", {
            owner,
            repo,
            branch,
            baseBranch,
            gitUrl
        });

        const response = await DashboardApiClient.postCreatePr({
            orgName,
            owner,
            repo,
            site,
            head: branch,
            base: baseBranch,
            title: title || DEFAULT_PR_TITLE,
            draft: true,
            gitUrl
        });

        console.log("[handleCreatePr] Response:", response);

        if (response.success) {
            try {
                // No need to await this, we just want to try to generate a PR description.
                void DashboardApiClient.generatePrDescription({
                    orgName,
                    owner,
                    site,
                    repo,
                    branch,
                    baseBranch,
                    gitUrl
                })
                    .then((result) => {
                        if (result.success && onAiGenerationComplete) {
                            onAiGenerationComplete();
                        }
                    })
                    .catch((error) => {
                        console.error("Error generating PR description:", error);
                    });
            } catch (error) {
                //Log error if we can't generate a PR description.
                console.error("Error generating PR description:", error);
            }
            return response.prUrl;
        } else {
            console.error("Failed to create PR:", response.error);
        }
    } catch (error) {
        console.error("Error creating PR:", error);
    }
    return undefined;
}

export function getOwnerAndRepoFromGithubUrl(githubUrl: string) {
    let piecesAfterGithubCom = githubUrl.split("github.com/")[1];
    if (piecesAfterGithubCom == null) {
        const sshMatch = githubUrl.match(/github\.com:(.+)/);
        if (sshMatch) {
            piecesAfterGithubCom = sshMatch[1];
        } else {
            return { owner: null, repo: null };
        }
    }
    const [owner, repoRaw] = piecesAfterGithubCom?.split("/").slice(0, 2) ?? [];
    if (repoRaw == null) {
        return { owner, repo: null };
    }
    const repo = repoRaw.replace(/\.git$/, "").replace(/\/$/, "");
    return { owner, repo };
}

export function getRepoDisplayNameFromUrl(gitUrl: string) {
    const { owner, repo } = parseGitUrl(gitUrl);
    if (owner == null || repo == null) {
        return gitUrl;
    }
    return `${owner}/${repo}`;
}

export interface NormalizedGithubUrl {
    owner: string | null;
    repo: string | null;
    canonicalUrl: string | null;
    isValidShape: boolean;
}

export function normalizeGithubUrl(input: string): NormalizedGithubUrl {
    const trimmed = input.trim();
    if (!trimmed) {
        return { owner: null, repo: null, canonicalUrl: null, isValidShape: false };
    }

    const { owner, repo } = getOwnerAndRepoFromGithubUrl(trimmed);

    if (!owner || !repo || owner === "" || repo === "") {
        return { owner: owner ?? null, repo: repo ?? null, canonicalUrl: null, isValidShape: false };
    }

    const canonicalUrl = `https://github.com/${owner}/${repo}`;
    return { owner, repo, canonicalUrl, isValidShape: true };
}

export function validateUrlIsGithubUrl(inputUrl: string): boolean {
    if (inputUrl === "") {
        return false;
    }
    // Check if URL starts with http/https
    if (!inputUrl.startsWith("https://") && !inputUrl.startsWith("http://")) {
        return false;
    }

    try {
        const url = new URL(inputUrl);
        // Check if domain is github.com
        if (url.hostname !== "github.com") {
            return false;
        }

        // Check if path has at least 2 segments (username/repo)
        const pathSegments = url.pathname.split("/").filter((segment) => segment.length > 0);
        if (pathSegments.length < 2) {
            return false;
        }

        return true;
    } catch {
        // If URL parsing fails, it's not a valid GitHub URL
        return false;
    }
}
