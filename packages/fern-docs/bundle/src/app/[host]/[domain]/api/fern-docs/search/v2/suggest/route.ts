import { cookies } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";

import { searchClient } from "@algolia/client-search";
import { getEnv } from "@vercel/functions";
import { kv } from "@vercel/kv";
import { generateObject } from "ai";
import { z } from "zod";

import { algoliaAppId } from "@fern-api/docs-server/env-variables";
import { isLocal } from "@fern-api/docs-server/isLocal";
import { isSelfHosted } from "@fern-api/docs-server/isSelfHosted";
import { getDocsDomainEdge } from "@fern-api/docs-server/xfernhost/edge";
import { COOKIE_FERN_TOKEN } from "@fern-api/docs-utils";
import { SuggestionsSchema, getLanguageModel } from "@fern-docs/search-ask-fern";
import { type AlgoliaRecord, SEARCH_INDEX } from "@fern-docs/search-keyword";

import { getFaiClient } from "@/getFaiClient";

const DEPLOYMENT_ID = getEnv().VERCEL_DEPLOYMENT_ID ?? "development";
const PREFIX = `docs:${DEPLOYMENT_ID}`;

// Allow streaming responses up to 30 seconds
export const maxDuration = 30;

const BodySchema = z.object({
    algoliaSearchKey: z.string()
});

export async function POST(req: NextRequest): Promise<Response> {
    if (isLocal() || isSelfHosted()) {
        return NextResponse.json("ai suggestions are not accessible in local preview mode", { status: 400 });
    }

    const { model: languageModel, provider: _ } = getLanguageModel("claude-4");

    const domain = getDocsDomainEdge(req);
    const cookieJar = await cookies();

    const isAskAiEnabled = (
        await getFaiClient({
            token: process.env.FERN_TOKEN ?? ""
        }).settings.getSettings({ domain })
    ).ask_ai_enabled;

    if (!isAskAiEnabled) {
        throw new Error(`Ask AI is not enabled for ${domain}`);
    }

    const cacheKey = `${PREFIX}:${domain}:suggestions`;
    if (!cookieJar.has(COOKIE_FERN_TOKEN)) {
        const cachedSuggestions = await kv.get(cacheKey);

        if (cachedSuggestions) {
            return NextResponse.json(cachedSuggestions, {
                status: 200,
                headers: { "Content-Type": "text/plain; charset=utf-8" }
            });
        }
    }

    const body = await req.json();
    const { algoliaSearchKey } = BodySchema.parse(body);

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
            mode: "json",
            system: `You are a helpful assistant that makes suggestions of questions for the user to ask about the documentation.
The prompt will be an array of separate search results that are JSON objects.
Generate exactly 5 questions based on the search results provided.
Your response must be in the following format:\n\n
{
  "suggestions": [
    "<question_1>",
    "<question_2>",
    "<question_3>",
    "<question_4>",
    "<question_5>"
  ]
}
\n
DO NOT include any explanatory text - only return the JSON object.`,
            prompt: response.hits
                .map(
                    (hit) =>
                        `# ${hit.title}\n${hit.description ?? ""}\n${hit.type === "changelog" || hit.type === "markdown" ? (hit.content ?? "") : ""}`
                )
                .join("\n\n"),
            maxRetries: 3,
            schema: SuggestionsSchema,
            experimental_telemetry: {
                isEnabled: true,
                recordInputs: true,
                recordOutputs: true,
                functionId: "ask_ai_suggest",
                metadata: {
                    domain,
                    indexName: SEARCH_INDEX,
                    languageModel: "claude-4"
                }
            }
        });
    } catch (error) {
        console.error("AI suggestions generation failed after retries, returning fallback suggestions:", error);
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

    if (result.object && !cookieJar.has(COOKIE_FERN_TOKEN)) {
        await kv.set(cacheKey, result.object);
        await kv.expire(cacheKey, 2 * 86400);
    }

    return NextResponse.json(result.object);
}
