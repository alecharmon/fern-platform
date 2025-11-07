import { searchClient } from "@algolia/client-search";
import { track } from "@fern-api/docs-server/analytics/posthog";
import { algoliaAppId } from "@fern-api/docs-server/env-variables";
import { isLocal } from "@fern-api/docs-server/isLocal";
import { isSelfHosted } from "@fern-api/docs-server/isSelfHosted";
import { getDocsDomainEdge } from "@fern-api/docs-server/xfernhost/edge";
import { COOKIE_FERN_TOKEN } from "@fern-api/docs-utils";
import { getLanguageModel, SuggestionsSchema } from "@fern-docs/search-ask-fern";
import { type AlgoliaRecord, SEARCH_INDEX } from "@fern-docs/search-keyword";
import { generateObject } from "ai";
import { unstable_cache } from "next/cache";
import { cookies } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getFaiClient } from "@/getFaiClient";

// Allow streaming responses up to 30 seconds
export const maxDuration = 30;

const BodySchema = z.object({
    algoliaSearchKey: z.string()
});

async function generateSuggestions(domain: string, algoliaSearchKey: string) {
    const modelId = "claude-4.5-haiku";
    const { model: languageModel, provider: _ } = getLanguageModel(modelId);

    const client = searchClient(algoliaAppId(), algoliaSearchKey);
    const response = await client.searchSingleIndex<AlgoliaRecord>({
        indexName: SEARCH_INDEX,
        searchParams: {
            query: "",
            hitsPerPage: 20,
            attributesToSnippet: [],
            attributesToHighlight: []
        }
    });

    let result;

    try {
        result = await generateObject({
            model: languageModel,
            mode: "tool",
            abortSignal: AbortSignal.timeout(25000),
            system: `You are a helpful assistant that makes suggestions of questions for the user to ask about the documentation.
The prompt will be an array of separate search results that are JSON objects.
Generate exactly 5 questions based on the search results provided.`,
            prompt: response.hits
                .map(
                    (hit) =>
                        `# ${hit.title}\n${hit.description ?? ""}\n${hit.type === "changelog" || hit.type === "markdown" ? (hit.content ?? "") : ""}`
                )
                .join("\n\n"),
            maxRetries: 0,
            schema: SuggestionsSchema,
            experimental_telemetry: {
                isEnabled: true,
                recordInputs: true,
                recordOutputs: true,
                functionId: "ask_ai_suggest",
                metadata: {
                    domain,
                    indexName: SEARCH_INDEX,
                    languageModel: modelId
                }
            }
        });
    } catch (error) {
        console.error("AI suggestions generation failed after retries, returning fallback suggestions:", error);
        track("ai_suggestions_generation_failed", {
            domain,
            error: String(error),
            indexName: SEARCH_INDEX,
            languageModel: modelId
        });
        result = {
            object: {
                suggestions: [
                    "How do I get started with this documentation?",
                    "What are the main features covered in this guide?",
                    "Where can I find API reference documentation?",
                    "What are the common use cases and examples?",
                    "How can I troubleshoot common issues?"
                ]
            }
        };
    }

    return result.object;
}

function getCachedSuggestions(domain: string, algoliaSearchKey: string) {
    const get = unstable_cache(() => generateSuggestions(domain, algoliaSearchKey), [domain], {
        tags: [domain]
    });
    return get();
}

export async function POST(req: NextRequest): Promise<Response> {
    if (isLocal() || isSelfHosted()) {
        return NextResponse.json("ai suggestions are not accessible in local preview mode", { status: 400 });
    }

    const domain = getDocsDomainEdge(req);
    const cookieJar = await cookies();

    const isAskAiEnabled = (
        await getFaiClient({
            token: process.env.FERN_TOKEN ?? ""
        }).settings.getDocsSettings({ domain })
    ).ask_ai_enabled;

    if (!isAskAiEnabled) {
        throw new Error(`Ask AI is not enabled for ${domain}`);
    }

    const body = await req.json();
    const { algoliaSearchKey } = BodySchema.parse(body);

    const isAuthenticated = cookieJar.has(COOKIE_FERN_TOKEN);

    if (isAuthenticated) {
        const suggestions = await generateSuggestions(domain, algoliaSearchKey);
        return NextResponse.json(suggestions);
    }

    const suggestions = await getCachedSuggestions(domain, algoliaSearchKey);

    return NextResponse.json(suggestions);
}
