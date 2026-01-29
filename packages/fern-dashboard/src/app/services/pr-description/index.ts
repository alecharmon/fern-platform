import type { Octokit } from "@octokit/core";
import { AnthropicClient } from "../anthropic";
import { DEFAULT_PR_TITLE } from "../github/github";

export interface PrDescriptionService {
    generateAndUpdatePrTitle: (params: {
        owner: string;
        repo: string;
        branch: string;
        baseBranch?: string;
    }) => Promise<{
        success: boolean;
        error?: string;
        newTitle?: string;
    }>;

    generateAndUpdatePrTitleAndDescription: (params: {
        owner: string;
        repo: string;
        branch: string;
        baseBranch?: string;
        site?: string;
        orgName?: string;
        slug?: string;
    }) => Promise<{
        success: boolean;
        error?: string;
        newTitle?: string;
        newDescription?: string;
    }>;
}

export class PrDescriptionServiceImpl implements PrDescriptionService {
    private readonly anthropicClient: AnthropicClient;

    constructor(
        private readonly octokit: Octokit,
        anthropicApiKey: string,
        private readonly user: { name?: string; email?: string }
    ) {
        this.anthropicClient = new AnthropicClient(anthropicApiKey);
    }

    async generateAndUpdatePrTitle({
        owner,
        repo,
        branch,
        baseBranch = "main"
    }: {
        owner: string;
        repo: string;
        branch: string;
        baseBranch?: string;
    }): Promise<{
        success: boolean;
        error?: string;
        newTitle?: string;
    }> {
        try {
            // Step 1: Get the PR for the current branch
            const pr = await this.getPrForBranch(owner, repo, branch, baseBranch);
            if (!pr) {
                return {
                    success: false,
                    error: `No pull request found for branch ${branch}`
                };
            }

            // Step 2: Get the diff for the PR
            const diff = await this.getPrDiff(owner, repo, pr.number);
            if (!diff) {
                return {
                    success: false,
                    error: "Failed to get PR diff"
                };
            }

            // Step 3: Generate description using Claude
            const newTitle = await this.anthropicClient.generateTitleFromDiff({
                diff,
                currentTitle: pr.title
            });
            if (!newTitle) {
                return {
                    success: false,
                    error: "Failed to generate new title"
                };
            }

            // Step 4: Update the PR title
            await this.updatePrTitle(owner, repo, pr.number, newTitle);

            return {
                success: true,
                newTitle
            };
        } catch (error) {
            console.error("Error in generateAndUpdatePrTitle:", error);
            return {
                success: false,
                error: error instanceof Error ? error.message : "Unknown error occurred"
            };
        }
    }

    async generateAndUpdatePrTitleAndDescription({
        owner,
        repo,
        branch,
        baseBranch = "main",
        site,
        orgName,
        slug
    }: {
        owner: string;
        repo: string;
        branch: string;
        baseBranch?: string;
        site?: string;
        orgName?: string;
        slug?: string;
    }): Promise<{
        success: boolean;
        error?: string;
        newTitle?: string;
        newDescription?: string;
    }> {
        try {
            // Step 1: Get the PR for the current branch
            const pr = await this.getPrForBranch(owner, repo, branch, baseBranch);
            if (!pr) {
                return {
                    success: false,
                    error: `No pull request found for branch ${branch}`
                };
            }

            // Step 2: Get the diff for the PR
            const diff = await this.getPrDiff(owner, repo, pr.number);
            if (!diff) {
                return {
                    success: false,
                    error: "Failed to get PR diff"
                };
            }

            // Step 3: Generate title and description using Claude
            const { newTitle, newDescription } = await this.anthropicClient.generateTitleAndDescriptionFromDiff({
                diff,
                currentTitle: pr.title,
                currentDescription: pr.body || ""
            });

            if (!newTitle || !newDescription) {
                return {
                    success: false,
                    error: "Failed to generate new title and description"
                };
            }

            // Step 4: Update the PR title and description
            await this.updatePrTitleAndDescription(owner, repo, pr.number, newTitle, newDescription, pr.title, {
                site,
                orgName,
                branch,
                slug
            });

            return {
                success: true,
                newTitle,
                newDescription
            };
        } catch (error) {
            console.error("Error in generateAndUpdatePrTitleAndDescription:", error);
            return {
                success: false,
                error: error instanceof Error ? error.message : "Unknown error occurred"
            };
        }
    }

    private async getPrForBranch(
        owner: string,
        repo: string,
        branch: string,
        baseBranch: string
    ): Promise<{ number: number; title: string; body?: string } | null> {
        try {
            const response = await this.octokit.request("GET /repos/{owner}/{repo}/pulls", {
                owner,
                repo,
                state: "open",
                head: `${owner}:${branch}`,
                base: baseBranch
            });

            const prs = response.data;
            if (prs.length === 0 || prs[0] == null) {
                return null;
            }

            return {
                number: prs[0].number,
                title: prs[0].title,
                body: prs[0].body || undefined
            };
        } catch (error) {
            console.error("Error getting PR for branch:", error);
            return null;
        }
    }

    private async getPrDiff(owner: string, repo: string, prNumber: number): Promise<any | null> {
        try {
            const response = await this.octokit.request("GET /repos/{owner}/{repo}/pulls/{pull_number}", {
                owner,
                repo,
                pull_number: prNumber,
                mediaType: {
                    format: "diff"
                }
            });
            return response.data;
        } catch (error) {
            console.error("Error getting PR diff:", error);
            return null;
        }
    }

    private appendFernSigningToDescription(
        description: string,
        editorInfo?: { site?: string; orgName?: string; branch?: string; slug?: string }
    ): string {
        // Build author string
        const authorPart =
            this.user.name || this.user.email
                ? `**Author:** ${this.user.name ?? ""} ${this.user.email ? `(${this.user.email})` : ""}`
                : "";

        // Build editor link if we have the required info
        let editorLinkPart = "";
        if (editorInfo?.site && editorInfo?.orgName && editorInfo?.branch) {
            const encodedSite = encodeURIComponent(editorInfo.site);
            // Include slug in the URL if available for direct page navigation
            const slugPath = editorInfo.slug ? `/${editorInfo.slug}` : "";
            const editorUrl = `https://dashboard.buildwithfern.com/${editorInfo.orgName}/editor/${encodedSite}/${editorInfo.branch}${slugPath}`;
            editorLinkPart = `[Continue editing in Fern Editor](${editorUrl}) *(PR author only)*`;
        }

        // Combine author and editor link on one line with bullet separator
        const authorLine =
            authorPart && editorLinkPart ? `${authorPart} • ${editorLinkPart}` : authorPart || editorLinkPart;

        return `${description}

---
${authorLine}

<sub>🌿 Generated with [Fern](https://www.buildwithfern.com)</sub>`;
    }

    private async updatePrTitleAndDescription(
        owner: string,
        repo: string,
        prNumber: number,
        newTitle: string,
        newDescription: string,
        existingPrTitle: string,
        editorInfo?: { site?: string; orgName?: string; branch?: string; slug?: string }
    ): Promise<void> {
        try {
            const update: Record<string, string> = {};
            // If the PR title is the default, update title
            if (existingPrTitle === DEFAULT_PR_TITLE) {
                update.title = newTitle;
            }

            await this.octokit.request("PATCH /repos/{owner}/{repo}/pulls/{pull_number}", {
                owner,
                repo,
                pull_number: prNumber,
                body: this.appendFernSigningToDescription(newDescription, editorInfo),
                ...update
            });
        } catch (error) {
            console.error("Error updating PR title and description:", error);
            throw error;
        }
    }

    private async updatePrTitle(owner: string, repo: string, prNumber: number, newTitle: string): Promise<void> {
        try {
            await this.octokit.request("PATCH /repos/{owner}/{repo}/pulls/{pull_number}", {
                owner,
                repo,
                pull_number: prNumber,
                title: newTitle
            });
        } catch (error) {
            console.error("Error updating PR title:", error);
            throw error;
        }
    }
}

export function createPrDescriptionService(
    octokit: Octokit,
    anthropicApiKey: string,
    user: { name?: string; email?: string }
): PrDescriptionService {
    return new PrDescriptionServiceImpl(octokit, anthropicApiKey, user);
}
