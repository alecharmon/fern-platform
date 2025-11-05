import { Anthropic } from "@anthropic-ai/sdk";
import type { Octokit } from "@octokit/core";

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
    }) => Promise<{
        success: boolean;
        error?: string;
        newTitle?: string;
        newDescription?: string;
    }>;
}

export class PrDescriptionServiceImpl implements PrDescriptionService {
    constructor(
        private readonly octokit: Octokit,
        private readonly anthropicApiKey: string,
        private readonly user: { name?: string; email?: string }
    ) {}

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
            const newTitle = await this.generateTitleFromDiff(diff, pr.title);
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
            const { newTitle, newDescription } = await this.generateTitleAndDescriptionFromDiff(
                diff,
                pr.title,
                pr.body || ""
            );

            if (!newTitle || !newDescription) {
                return {
                    success: false,
                    error: "Failed to generate new title and description"
                };
            }

            // Step 4: Update the PR title and description
            await this.updatePrTitleAndDescription(owner, repo, pr.number, newTitle, newDescription, pr.title);

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

    private async generateTitleAndDescriptionFromDiff(
        diff: string,
        currentTitle: string,
        currentDescription: string
    ): Promise<{ newTitle: string | null; newDescription: string | null }> {
        try {
            const anthropic = new Anthropic({
                apiKey: this.anthropicApiKey
            });

            const prompt = `Generate a concise PR title and description from this code diff.

Current PR title: "${currentTitle}"
Current PR description: "${currentDescription}"

\`\`\`diff
${diff}
\`\`\`

**Title (max 50 chars):**
- Use conventional commit style when appropriate (feat:, fix:, docs:, style:, refactor:, etc.)
- Describe what changed, not why
- Be specific and direct

**Description (max 400 chars):**
Write 1-3 direct sentences OR 2-3 bullet points stating what changed.

Rules:
- State the changes factually and concisely
- No meta-commentary (avoid "This PR...", "These changes...", "This updates...")
- No explanations of purpose or reasoning
- No introductory phrases or summaries
- Assume reader knows the codebase

Good examples:
"Fix bad links found via automated testing."

"Fixes all broken links on API Preview Overview Page"

"Update API reference with the endpoint to install Discord."

"Change information architecture to add a new tab."

"Clarify that self hosting is coming soon for <product>."

"Minor fix for "RX" instead of "prescription""

"Updated some colors in the CSS for accessibility."

"- Renamed validateUser() to authenticateUser()
- Changed error messages to include error codes  
- Added TypeScript type annotations"

Bad examples:
"This PR makes formatting improvements to several MDX documentation files, including:"
"The changes are primarily formatting-focused with minimal content changes."
"This PR updates the authentication flow to improve security and add new features."

Format your response as:
[TITLE]
[DESCRIPTION]`;

            const response = await anthropic.messages.create({
                model: "claude-sonnet-4-20250514",
                max_tokens: 1000,
                temperature: 0.3,
                messages: [
                    {
                        role: "user",
                        content: prompt
                    }
                ]
            });

            const content = response.content[0]?.type === "text" ? response.content[0].text.trim() : null;

            if (!content) {
                return { newTitle: null, newDescription: null };
            }

            try {
                // TODO: response should be a JSON object
                //       was not working, used new lines instead
                const cleanedContent = content.trim();
                const lines = cleanedContent.split("\n");
                const newTitle = lines[0];
                const newDescription = lines.slice(1).join("\n");

                if (!newTitle || newTitle.length > 100 || !newDescription || newDescription.length > 1000) {
                    return { newTitle: null, newDescription: null };
                }

                return { newTitle, newDescription };
            } catch (parseError) {
                console.error("Error parsing AI response:", parseError);
                return { newTitle: null, newDescription: null };
            }
        } catch (error) {
            console.error("Error generating title and description from diff:", error);
            return { newTitle: null, newDescription: null };
        }
    }

    private appendFernSigningToDescription(description: string): string {
        const authorString =
            this.user.name || this.user.email
                ? `**Author:** ${this.user.name ?? ""} ${this.user.email ? `(${this.user.email})` : ""}`
                : "";
        return `${description} \
    \n<br>
    \n${authorString}
    \n🌿 Title and description generated with [Fern](https://www.buildwithfern.com)
    `;
    }

    private async generateTitleFromDiff(diff: string, currentTitle: string): Promise<string | null> {
        try {
            const anthropic = new Anthropic({
                apiKey: this.anthropicApiKey
            });

            const prompt = `You are a helpful assistant that generates concise, descriptive pull request titles based on code diffs.

Current PR title: "${currentTitle}"

Here is the diff for the pull request:

\`\`\`diff
${diff}
\`\`\`

Please generate a new, concise title (max 100 characters) that accurately describes the changes in this diff. The title should be:
- Clear and descriptive
- Follow conventional commit message style if applicable
- Focus on what the changes accomplish
- Be specific but concise

Return only the title, nothing else.`;

            const response = await anthropic.messages.create({
                model: "claude-sonnet-4-20250514",
                max_tokens: 150,
                temperature: 0.3,
                messages: [
                    {
                        role: "user",
                        content: prompt
                    }
                ]
            });

            const newTitle = response.content[0]?.type === "text" ? response.content[0].text.trim() : null;

            if (!newTitle || newTitle.length > 100) {
                return null;
            }

            return newTitle;
        } catch (error) {
            console.error("Error generating title from diff:", error);
            return null;
        }
    }

    private async updatePrTitleAndDescription(
        owner: string,
        repo: string,
        prNumber: number,
        newTitle: string,
        newDescription: string,
        existingPrTitle: string
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
                body: this.appendFernSigningToDescription(newDescription),
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
