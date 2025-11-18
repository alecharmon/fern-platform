import { searchClient } from "@algolia/client-search";
import { track } from "@fern-api/docs-server/analytics/posthog";
import { algoliaAppId } from "@fern-api/docs-server/env-variables";
import { isLocal } from "@fern-api/docs-server/isLocal";
import { isSelfHosted } from "@fern-api/docs-server/isSelfHosted";
import { getDocsDomainEdge } from "@fern-api/docs-server/xfernhost/edge";
import { COOKIE_FERN_TOKEN } from "@fern-api/docs-utils";
import { getLanguageModel, measureAsync, SuggestionsSchema } from "@fern-docs/search-ask-fern";
import { type AlgoliaRecord, SEARCH_INDEX } from "@fern-docs/search-keyword";
import { generateObject } from "ai";
import { unstable_cache } from "next/cache";
import { cookies } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getFaiClient } from "@/getFaiClient";

// Allow streaming responses up to 30 seconds
export const maxDuration = 30;

export async function OPTIONS(_: NextRequest): Promise<NextResponse> {
    return new NextResponse(null, {
        status: 204,
        headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "POST, OPTIONS",
            "Access-Control-Allow-Headers": "*"
        }
    });
}

const CACHE_HIT_THRESHOLD_MS = 100;

const BodySchema = z.object({
    algoliaSearchKey: z.string()
});

interface SuggestionMetrics {
    algoliaSearchDurationMs: number;
    llmCallDurationMs: number;
    modelId: string;
    numAlgoliaResults: number;
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
    success: boolean;
    usedFallback: boolean;
    wasCached: boolean;
}

async function generateSuggestions(
    domain: string,
    algoliaSearchKey: string,
    wasCached = false
): Promise<{ suggestions: string[]; metrics: SuggestionMetrics }> {
    const modelId = "claude-4.5-haiku";
    const { model: languageModel, provider: _ } = getLanguageModel(modelId, { forStructuredOutput: true });

    const client = searchClient(algoliaAppId(), algoliaSearchKey);

    const [response, algoliaSearchDurationMs] = await measureAsync(() =>
        client.searchSingleIndex<AlgoliaRecord>({
            indexName: SEARCH_INDEX,
            searchParams: {
                query: "",
                hitsPerPage: 20,
                attributesToSnippet: [],
                attributesToHighlight: []
            }
        })
    );

    let result;
    let llmCallDurationMs = 0;
    let usedFallback = false;

    try {
        const [llmResult, llmDuration] = await measureAsync(() =>
            generateObject({
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
            })
        );
        result = llmResult;
        llmCallDurationMs = llmDuration;
    } catch (error) {
        console.error("AI suggestions generation failed after retries, returning fallback suggestions:", error);
        track("ai_suggestions_generation_failed", {
            domain,
            error: String(error),
            indexName: SEARCH_INDEX,
            languageModel: modelId,
            algoliaSearchDurationMs,
            numAlgoliaResults: response.hits.length
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
            },
            usage: undefined
        };
        usedFallback = true;
    }

    return {
        suggestions: result.object.suggestions,
        metrics: {
            algoliaSearchDurationMs,
            llmCallDurationMs,
            modelId,
            numAlgoliaResults: response.hits.length,
            inputTokens: result.usage?.inputTokens,
            outputTokens: result.usage?.outputTokens,
            totalTokens: result.usage?.totalTokens,
            success: !usedFallback,
            usedFallback,
            wasCached
        }
    };
}

async function getCachedSuggestions(domain: string, algoliaSearchKey: string) {
    const beforeCache = Date.now();
    const get = unstable_cache(() => generateSuggestions(domain, algoliaSearchKey, false), [domain], {
        tags: [domain]
    });
    const result = await get();
    const cacheExecutionMs = Date.now() - beforeCache;

    const wasCached = cacheExecutionMs < CACHE_HIT_THRESHOLD_MS;
    result.metrics.wasCached = wasCached;

    return result;
}

export async function POST(req: NextRequest): Promise<Response> {
    const requestStart = Date.now();

    if (isLocal() || isSelfHosted()) {
        return NextResponse.json("ai suggestions are not accessible in local preview mode", { status: 400 });
    }

    const domain = getDocsDomainEdge(req);
    const cookieJar = await cookies();

    const [settings, settingsFetchDurationMs] = await measureAsync(() =>
        getFaiClient({
            token: process.env.FERN_TOKEN ?? ""
        }).settings.getDocsSettings({ domain })
    );

    if (!settings.ask_ai_enabled) {
        throw new Error(`Ask AI is not enabled for ${domain}`);
    }

    let body;
    let rawBody: string | undefined;
    try {
        rawBody = await req.text();
        body = JSON.parse(rawBody);
    } catch (error) {
        console.error(`[${domain}] Failed to parse request body - possible injection attempt:`, {
            error: error instanceof Error ? error.message : String(error),
            headers: Object.fromEntries(req.headers.entries()),
            url: req.url,
            rawBody: rawBody?.substring(0, 1000) ?? "[Unable to read body]"
        });
        return NextResponse.json({ error: "Invalid JSON in request body" }, { status: 400 });
    }

    const { algoliaSearchKey } = BodySchema.parse(body);

    const isAuthenticated = cookieJar.has(COOKIE_FERN_TOKEN);

    const { suggestions, metrics } = isAuthenticated
        ? await generateSuggestions(domain, algoliaSearchKey)
        : await getCachedSuggestions(domain, algoliaSearchKey);

    const totalDurationMs = Date.now() - requestStart;

    track("ask_ai_suggest", {
        domain,
        languageModel: metrics.modelId,
        indexName: SEARCH_INDEX,
        totalDurationMs,
        settingsFetchDurationMs,
        algoliaSearchDurationMs: metrics.algoliaSearchDurationMs,
        llmCallDurationMs: metrics.llmCallDurationMs,
        cacheHit: metrics.wasCached,
        isAuthenticated,
        numAlgoliaResults: metrics.numAlgoliaResults,
        numSuggestionsGenerated: suggestions.length,
        inputTokens: metrics.inputTokens,
        outputTokens: metrics.outputTokens,
        totalTokens: metrics.totalTokens,
        success: metrics.success,
        usedFallback: metrics.usedFallback
    });

    return NextResponse.json({ suggestions });
}
