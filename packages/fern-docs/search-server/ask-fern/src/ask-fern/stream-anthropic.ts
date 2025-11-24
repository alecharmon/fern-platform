import { track } from "@fern-api/docs-server";
import { fernToken_admin, getFaiOrigin } from "@fern-api/docs-server/env-variables";
import { FernAIClient } from "@fern-api/fai-sdk";
import type { FacetFilter } from "@fern-docs/search-keyword";
import {
    convertToModelMessages,
    createUIMessageStream,
    createUIMessageStreamResponse,
    type EmbeddingModel,
    type LanguageModel,
    type ModelMessage,
    NoSuchToolError,
    stepCountIs,
    streamText,
    tool,
    type UIMessage
} from "ai";
import { FallbackModel } from "ai-fallback";
import z from "zod";

import {
    convertTpufRecordsToDocuments,
    createChatSystemPrompt,
    isAuthError,
    type TurbopufferAuthError,
    type TurbopufferQueryMetrics,
    type TurbopufferRecord
} from "../index";
import { estimateTokens, estimateTokensFromArray } from "../utils/estimate-tokens";
import { runQueryTurbopuffer } from "./run-query-turbopuffer";
import { MAX_QUERY_ATTEMPTS, TOP_K } from "./stream-constants";

export async function runRouteForAnthropic({
    domain,
    chatSource,
    promptTemplate,
    conversationId,
    lastUserMessage,
    messages,
    filters,
    explodedRoles,
    embeddingModel,
    turbopufferNamespace,
    languageModel,
    documentUrls,
    userIsAuthed,
    skipSaveQuery,
    routeMetrics
}: {
    domain: string;
    chatSource: string;
    promptTemplate?: string;
    conversationId: string;
    lastUserMessage: string;
    messages: UIMessage[];
    filters: FacetFilter[];
    explodedRoles: string[];
    embeddingModel: EmbeddingModel<string>;
    turbopufferNamespace: string;
    languageModel: LanguageModel;
    documentUrls?: string[];
    userIsAuthed: boolean;
    skipSaveQuery?: boolean;
    routeMetrics?: {
        authDurationMs: number;
        loaderDurationMs: number;
        settingsFetchDurationMs: number;
        configLoadDurationMs: number;
        queryCreationDurationMs: number;
    };
}): Promise<Response | TurbopufferAuthError> {
    const faiClient = new FernAIClient({
        baseUrl: getFaiOrigin(),
        token: fernToken_admin()
    });

    let modelMessages: ModelMessage[] = convertToModelMessages(messages);

    const start = Date.now();

    const searchResultURLs = new Set<string>();
    const searchResults: TurbopufferRecord[] = [];

    const { result: turbopufferResults, metrics: initialTurbopufferMetrics } = await runQueryTurbopuffer(
        lastUserMessage,
        {
            embeddingModel,
            namespace: turbopufferNamespace,
            topK: 3,
            filters,
            documentUrls,
            explodedRoles,
            userIsAuthed
        }
    );

    if (isAuthError(turbopufferResults)) {
        return turbopufferResults;
    }

    for (const result of turbopufferResults) {
        if (result.attributes.url) {
            if (!searchResultURLs.has(result.attributes.url)) {
                searchResultURLs.add(result.attributes.url);
                searchResults.push(result);
            }
        } else {
            searchResults.push(result);
        }
    }

    const searchResultSources = searchResults.map((hit) => {
        return {
            title: hit.attributes.title,
            url: hit.attributes.url
        };
    });

    const systemPromptDocuments = convertTpufRecordsToDocuments(searchResults);

    const systemMessages = createChatSystemPrompt({
        modelProvider: "anthropic",
        domain,
        documents: systemPromptDocuments.join("\n\n"),
        promptTemplate,
        availableTools: ["documentationSearch"]
    });

    modelMessages = [...systemMessages, ...modelMessages];

    const documentIdsToIgnore: string[] = [];
    const urlsToIgnore: string[] = searchResultSources.map((source) => source.url);
    let timeToFirstToken: number | undefined = undefined;
    let responseText = "";

    const initialSearchResultTokens = estimateTokensFromArray(systemPromptDocuments);
    let toolCallResultTokens = 0;
    const toolCallDocumentCounts: { documentationSearch: number } = {
        documentationSearch: 0
    };

    const toolCallMetrics: TurbopufferQueryMetrics[] = [];

    const assistantQueryId = crypto.randomUUID();

    const uiMessageStream = createUIMessageStream({
        execute({ writer }) {
            writer.write({
                type: "data-sources",
                data: searchResultSources
            });

            writer.write({
                type: "data-assistant-query-id",
                data: assistantQueryId
            });

            let numToolCalls = 0;

            const result = streamText({
                model: languageModel,
                messages: modelMessages,
                temperature: 0.0,
                maxRetries: 3,
                stopWhen: stepCountIs(10),
                prepareStep: async () => {
                    return {
                        activeTools: ["documentationSearch"]
                    };
                },
                tools: {
                    documentationSearch: tool({
                        description: "Search the knowledge base for the user's query with semantic search and bm25",
                        inputSchema: z.object({
                            query: z.string()
                        }),
                        async execute({ query }) {
                            numToolCalls++;
                            const response = [];
                            for (let i = 0; i < MAX_QUERY_ATTEMPTS; i++) {
                                const { result, metrics } = await runQueryTurbopuffer(query, {
                                    embeddingModel,
                                    namespace: turbopufferNamespace,
                                    topK: TOP_K,
                                    documentIdsToIgnore: documentIdsToIgnore,
                                    urlsToIgnore: urlsToIgnore,
                                    filters,
                                    explodedRoles,
                                    userIsAuthed
                                });

                                toolCallMetrics.push(metrics);

                                if (isAuthError(result)) {
                                    return [
                                        {
                                            error: "unauthorized",
                                            message: result.message,
                                            requiresAuth: true
                                        }
                                    ];
                                }

                                for (const hit of result) {
                                    const url = hit.attributes.url;
                                    documentIdsToIgnore.push(hit.id);
                                    if (url != null && !urlsToIgnore.includes(url)) {
                                        urlsToIgnore.push(url);
                                        const document =
                                            hit.attributes.document.length > 20000
                                                ? hit.attributes.document.slice(0, 20000)
                                                : hit.attributes.document;
                                        response.push({
                                            ...hit.attributes,
                                            document,
                                            url
                                        });

                                        toolCallResultTokens += estimateTokens(document);
                                        toolCallDocumentCounts.documentationSearch++;
                                        if (response.length >= TOP_K) {
                                            return response;
                                        }
                                    }
                                }
                                if (response.length >= TOP_K) {
                                    return response;
                                }
                            }
                            return response;
                        }
                    })
                },
                onChunk: (chunk) => {
                    if (chunk.chunk.type === "text-delta" && chunk.chunk.text.length > 0) {
                        if (timeToFirstToken == null) {
                            timeToFirstToken = Date.now() - start;
                        }
                        responseText += chunk.chunk.text;
                    }
                },
                onError: (event) => {
                    const error = event.error;
                    if (error == null) {
                        return;
                    }

                    let errorKind = "UnknownError";
                    if (NoSuchToolError.isInstance(error)) {
                        errorKind = "NoSuchToolError";
                    }

                    console.error(
                        `Encountered a ${errorKind} for query '${lastUserMessage}: ${JSON.stringify(error)}'`
                    );

                    const { activeLanguageModel, activeModelProvider } = getModelUsageInfo(languageModel);

                    let errorString = JSON.stringify(error);
                    if (errorString.length > 1000) {
                        errorString = errorString.slice(0, 1000) + "...";
                    }

                    track("ask_ai_error", {
                        domain,
                        chatSource,
                        languageModel: activeLanguageModel,
                        provider: activeModelProvider,
                        conversationId,
                        errorKind,
                        error: errorString
                    });
                },
                onFinish: async (e) => {
                    const end = Date.now();
                    if (!skipSaveQuery) {
                        try {
                            await faiClient.query.createQuery({
                                domain,
                                body: {
                                    query_id: assistantQueryId,
                                    conversation_id: conversationId,
                                    domain,
                                    text: responseText,
                                    role: "ASSISTANT",
                                    source: chatSource.toUpperCase(),
                                    created_at: new Date(end).toISOString(),
                                    time_to_first_token: timeToFirstToken
                                }
                            });
                        } catch (error) {
                            console.log("Error creating assistant query", error);
                        }
                    }
                    const { activeLanguageModel, activeModelProvider } = getModelUsageInfo(languageModel);

                    const totalToolCallDurationMs = toolCallMetrics.reduce((sum, m) => sum + m.durationMs, 0);
                    const totalToolCallResults = toolCallMetrics.reduce((sum, m) => sum + m.numResults, 0);
                    const avgToolCallDurationMs =
                        toolCallMetrics.length > 0 ? totalToolCallDurationMs / toolCallMetrics.length : 0;

                    track("ask_ai", {
                        languageModel: activeLanguageModel,
                        provider: activeModelProvider,
                        embeddingModel: embeddingModel.valueOf().toString(),
                        durationMs: end - start,
                        timeToFirstToken,
                        domain,
                        namespace: turbopufferNamespace,
                        numToolCalls,
                        finishReason: e.finishReason,
                        estimatedInitialSearchResultTokens: initialSearchResultTokens,
                        estimatedToolCallResultTokens: toolCallResultTokens,
                        numInitialSearchResults: searchResults.length,
                        numDocumentationSearchResults: toolCallDocumentCounts.documentationSearch,
                        initialTurbopufferDurationMs: initialTurbopufferMetrics.durationMs,
                        initialTurbopufferMode: initialTurbopufferMetrics.mode,
                        initialTurbopufferNumResults: initialTurbopufferMetrics.numResults,
                        initialTurbopufferSemanticDurationMs: initialTurbopufferMetrics.semanticQueryDurationMs,
                        initialTurbopufferBm25DurationMs: initialTurbopufferMetrics.bm25QueryDurationMs,
                        initialTurbopufferEmbeddingDurationMs: initialTurbopufferMetrics.embeddingDurationMs,
                        toolCallTurbopufferTotalDurationMs: totalToolCallDurationMs,
                        toolCallTurbopufferAvgDurationMs: avgToolCallDurationMs,
                        toolCallTurbopufferTotalResults: totalToolCallResults,
                        numTurbopufferToolCalls: toolCallMetrics.length,
                        ...(routeMetrics || {}),
                        ...e.usage
                    });
                    e.warnings?.forEach((warning) => {
                        console.warn(warning);
                    });
                },
                headers: {
                    "Access-Control-Allow-Origin": "*",
                    "Access-Control-Allow-Methods": "POST, OPTIONS",
                    "Access-Control-Allow-Headers": "Content-Type"
                }
            });

            const uiStream = result.toUIMessageStream();
            const filteredStream = filterToolEventsFromStream(uiStream);
            writer.merge(filteredStream);
        }
    });

    return createUIMessageStreamResponse({ stream: uiMessageStream });
}

const TOOL_EVENT_TYPES = new Set([
    "tool-input-start",
    "tool-input-delta",
    "tool-input-available",
    "tool-output-available"
]);

function filterToolEventsFromStream<T>(stream: ReadableStream<T>): ReadableStream<T> {
    return stream.pipeThrough(
        new TransformStream<T, T>({
            transform(chunk, controller) {
                if (typeof chunk === "object" && chunk !== null && "type" in chunk) {
                    if (TOOL_EVENT_TYPES.has(chunk.type as string)) {
                        return;
                    }
                }
                controller.enqueue(chunk);
            }
        })
    );
}

function getModelUsageInfo(languageModel: LanguageModel): {
    activeLanguageModel?: string;
    activeModelProvider?: string;
} {
    if (typeof languageModel === "string") {
        return {
            activeLanguageModel: languageModel
        };
    } else if (languageModel instanceof FallbackModel) {
        return {
            activeLanguageModel: languageModel.settings.models[languageModel.currentModelIndex]?.modelId,
            activeModelProvider: languageModel.settings.models[languageModel.currentModelIndex]?.provider ?? "anthropic"
        };
    } else {
        return {
            activeLanguageModel: languageModel.modelId,
            activeModelProvider: languageModel.provider
        };
    }
}
