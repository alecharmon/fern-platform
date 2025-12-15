import { type AnthropicProvider, createAnthropic } from "@ai-sdk/anthropic";
import { Anthropic } from "@anthropic-ai/sdk";
import { generateObject } from "ai";
import { type BrandProfile, BrandProfileSchema } from "../auto-populate-brand";

type ErrorOptions = { cause?: unknown; retriable?: boolean };

export class AnthropicError extends Error {
    retriable: boolean;

    constructor(message: string, options?: ErrorOptions) {
        super(message);
        this.name = this.constructor.name;
        if (options?.cause) {
            this.cause = options.cause;
        }
        this.retriable = options?.retriable ?? false;
    }
}

export class AnthropicInitError extends AnthropicError {}
export class AnthropicGenerationError extends AnthropicError {}

export class AnthropicClient {
    private readonly client: Anthropic;
    // Use this for Anthropic SDK calls that require provider settings
    private readonly provider: AnthropicProvider;

    constructor(apiKey?: string) {
        let anthropicApiKey = apiKey ?? process.env.ANTHROPIC_API_KEY;
        if (!anthropicApiKey) {
            throw new AnthropicInitError("Anthropic API not set or provided key is missing");
        }

        try {
            this.client = new Anthropic({ apiKey: anthropicApiKey });
            this.provider = createAnthropic({ apiKey: anthropicApiKey });
        } catch (error) {
            throw new AnthropicInitError("Failed to initialize Anthropic client", { cause: error });
        }
    }

    async generateTitleAndDescriptionFromDiff({
        diff,
        currentTitle,
        currentDescription
    }: {
        diff: string;
        currentTitle: string;
        currentDescription: string;
    }): Promise<{ newTitle: string | null; newDescription: string | null }> {
        try {
            const prompt = `Generate a concise PR title and description from this code diff.

Current PR title: \"${currentTitle}\"
Current PR description: \"${currentDescription}\"

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
- No meta-commentary (avoid \"This PR...\", \"These changes...\", \"This updates...\")
- No explanations of purpose or reasoning
- No introductory phrases or summaries
- Assume reader knows the codebase

Good examples:
\"Fix bad links found via automated testing.\"

\"Fixes all broken links on API Preview Overview Page\"

\"Update API reference with the endpoint to install Discord.\"

\"Change information architecture to add a new tab.\"

\"Clarify that self hosting is coming soon for <product>.\"

\"Minor fix for \"RX\" instead of \"prescription\"\"

\"Updated some colors in the CSS for accessibility.\"

\"- Renamed validateUser() to authenticateUser()\n- Changed error messages to include error codes  \n- Added TypeScript type annotations\"

Bad examples:
\"This PR makes formatting improvements to several MDX documentation files, including:\"
\"The changes are primarily formatting-focused with minimal content changes.\"
\"This PR updates the authentication flow to improve security and add new features.\"

Format your response as:
[TITLE]
[DESCRIPTION]`;

            const response = await this.withRetries(() =>
                this.client.messages
                    .create({
                        model: "claude-sonnet-4-20250514",
                        max_tokens: 1000,
                        temperature: 0.3,
                        messages: [
                            {
                                role: "user",
                                content: prompt
                            }
                        ]
                    })
                    .catch((error) => {
                        throw new AnthropicGenerationError("Anthropic message creation failed", {
                            cause: error,
                            retriable: true
                        });
                    })
            );

            const content = response.content[0]?.type === "text" ? response.content[0].text.trim() : null;

            if (!content) {
                console.error(new AnthropicGenerationError("Anthropic response did not include text content"));
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
                    console.error(
                        new AnthropicGenerationError("Anthropic response exceeded expected length constraints")
                    );
                    return { newTitle: null, newDescription: null };
                }

                return { newTitle, newDescription };
            } catch (parseError) {
                console.error(
                    new AnthropicGenerationError("Failed to parse Anthropic response", { cause: parseError })
                );
                return { newTitle: null, newDescription: null };
            }
        } catch (error) {
            console.error(
                error instanceof AnthropicError
                    ? error
                    : new AnthropicGenerationError("Error generating title and description from diff, returning null", {
                          cause: error
                      })
            );
            return { newTitle: null, newDescription: null };
        }
    }

    async generateBrandProfileFromUrl(url: string): Promise<BrandProfile | null> {
        try {
            const response = await fetch(url);
            if (!response.ok) {
                console.error(
                    new AnthropicGenerationError("Failed to fetch URL for brand profile extraction", {
                        cause: response.statusText,
                        retriable: false
                    })
                );
                return null;
            }

            const html = await response.text();
            const truncatedContent = html.slice(0, 20_000);

            const result = await this.withRetries(() =>
                generateObject({
                    model: this.provider("claude-sonnet-4-5"),
                    schema: BrandProfileSchema,
                    prompt: `You are an expert brand profiler. Extract structured brand metadata from the page content at ${url}.

Return the brand object matching the provided schema. Prefer explicit facts on the page; otherwise infer cautiously.
If data is unavailable, return null for that field and empty arrays where appropriate.

Avoid using black or white if possible for the brand color and use the CSS and the logo for color detection as a fallback.

Page content (truncated to 20k chars):
${truncatedContent}`
                }).catch((error: any) => {
                    throw new AnthropicGenerationError("Anthropic generateObject failed", {
                        cause: error,
                        retriable: true
                    });
                })
            );

            return (result as { object: BrandProfile }).object;
        } catch (error) {
            console.error("Error in generateBrandProfileFromUrl:", error);
            console.error(
                error instanceof AnthropicError
                    ? error
                    : new AnthropicGenerationError("Error generating brand profile from URL, returning null", {
                          cause: error
                      })
            );
            return null;
        }
    }

    async generateTitleFromDiff({
        diff,
        currentTitle
    }: {
        diff: string;
        currentTitle: string;
    }): Promise<string | null> {
        try {
            const prompt = `You are a helpful assistant that generates concise, descriptive pull request titles based on code diffs.

Current PR title: \"${currentTitle}\"

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

            const response = await this.withRetries(() =>
                this.client.messages
                    .create({
                        model: "claude-sonnet-4-20250514",
                        max_tokens: 150,
                        temperature: 0.3,
                        messages: [
                            {
                                role: "user",
                                content: prompt
                            }
                        ]
                    })
                    .catch((error) => {
                        throw new AnthropicGenerationError("Anthropic message creation failed", {
                            cause: error,
                            retriable: true
                        });
                    })
            );

            const newTitle = response.content[0]?.type === "text" ? response.content[0].text.trim() : null;

            if (!newTitle || newTitle.length > 100) {
                console.error(
                    new AnthropicGenerationError("Anthropic response missing title or exceeded length", {
                        cause: newTitle
                    })
                );
                return null;
            }

            return newTitle;
        } catch (error) {
            console.error(
                error instanceof AnthropicError
                    ? error
                    : new AnthropicGenerationError("Error generating title from diff, returning null", { cause: error })
            );
            return null;
        }
    }

    private async withRetries<T>(fn: () => Promise<T>, retries = 3): Promise<T> {
        let attempt = 0;
        while (attempt < retries) {
            try {
                return await fn();
            } catch (error) {
                attempt += 1;
                const shouldRetry = error instanceof AnthropicError && error.retriable && attempt < retries;
                if (!shouldRetry) {
                    throw error;
                }
            }
        }

        // This should be unreachable because the function either returns or throws above.
        throw new AnthropicGenerationError("withRetries exhausted without returning");
    }
}
