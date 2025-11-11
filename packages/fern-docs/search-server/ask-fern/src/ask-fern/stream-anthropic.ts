import { postToSlack, track } from "@fern-api/docs-server";
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
    type UIDataTypes,
    type UIMessage,
    type UIMessagePart,
    type UITools
} from "ai";
import { FallbackModel } from "ai-fallback";
import z from "zod";

import {
    convertTpufRecordsToDocuments,
    createChatSystemPrompt,
    getTurbopufferNamespace,
    isAuthError,
    type TurbopufferAuthError,
    type TurbopufferRecord
} from "../index";
import { getCodeIndexName } from "../turbopuffer/utils/get-turbopuffer-namespace";
import { estimateTokens, estimateTokensFromArray } from "../utils/estimate-tokens";
import { runQueryTurbopuffer } from "./run-query-turbopuffer";
import { MAX_QUERY_ATTEMPTS, TOP_K, TOP_K_CODE } from "./stream-constants";

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
    skipSaveQuery
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
}): Promise<Response | TurbopufferAuthError> {
    const faiClient = new FernAIClient({
        baseUrl: getFaiOrigin(),
        token: fernToken_admin()
    });

    /*
    Anthropic's API has a bug (see: https://github.com/anthropics/claude-code/issues/473)
    Where tool calls are not formatted properly, breaking messages that contain tool calls.
    This is a manual fix - we simply filter out tool call responses.

    Will file an issue with Vercel to fix this, but for now this is not blocking.
  */

    const cleanedMessages: UIMessage[] = [];
    for (const message of messages) {
        if (message.role === "assistant") {
            message.parts = message.parts.filter((part: UIMessagePart<UIDataTypes, UITools>) => part.type === "text");
            // Skip assistant messages with no text parts
            if (message.parts.length === 0) {
                continue;
            }
        }
        cleanedMessages.push(message);
    }
    const modelMessages: ModelMessage[] = convertToModelMessages(cleanedMessages);

    const start = Date.now();

    const searchResultURLs = new Set<string>();
    const searchResults: TurbopufferRecord[] = [];

    const turbopufferResults = await runQueryTurbopuffer(lastUserMessage, {
        embeddingModel,
        namespace: turbopufferNamespace,
        topK: 3,
        filters,
        documentUrls,
        explodedRoles,
        userIsAuthed
    });

    // If there's an auth error, return it immediately instead of passing through the LLM
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

    const systemPrompt = createChatSystemPrompt({
        modelProvider: "anthropic",
        domain,
        date: new Date().toDateString(),
        documents: systemPromptDocuments.join("\n\n"),
        promptTemplate,
        availableTools: ["documentationSearch"]
    });

    const documentIdsToIgnore: string[] = [];
    const urlsToIgnore: string[] = searchResultSources.map((source) => source.url);
    let timeToFirstToken: number | undefined = undefined;
    let responseText = "";

    const initialSearchResultTokens = estimateTokensFromArray(systemPromptDocuments);
    let toolCallResultTokens = 0;
    const toolCallDocumentCounts: { documentationSearch: number; codeSearch: number } = {
        documentationSearch: 0,
        codeSearch: 0
    };

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
                system: systemPrompt,
                messages: modelMessages,
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
                                const result = await runQueryTurbopuffer(query, {
                                    embeddingModel,
                                    namespace: turbopufferNamespace,
                                    topK: TOP_K,
                                    documentIdsToIgnore: documentIdsToIgnore,
                                    urlsToIgnore: urlsToIgnore,
                                    filters,
                                    explodedRoles,
                                    userIsAuthed
                                });

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
                    }),
                    codeSearch: tool({
                        description: "Search code snippets for the user's query with semantic search and bm25",
                        inputSchema: z.object({
                            query: z.string()
                        }),
                        async execute({ query }) {
                            numToolCalls++;
                            const result = await runQueryTurbopuffer(query, {
                                embeddingModel,
                                namespace: getTurbopufferNamespace(domain, getCodeIndexName()),
                                topK: TOP_K_CODE,
                                documentIdsToIgnore: documentIdsToIgnore,
                                filters,
                                explodedRoles,
                                userIsAuthed
                            });

                            if (isAuthError(result)) {
                                return [
                                    {
                                        error: "unauthorized",
                                        message: result.message,
                                        requiresAuth: true
                                    }
                                ];
                            }

                            return result.map((hit) => {
                                const document =
                                    hit.attributes.document.length > 20000
                                        ? hit.attributes.document.slice(0, 20000)
                                        : hit.attributes.document;

                                toolCallResultTokens += estimateTokens(document);
                                toolCallDocumentCounts.codeSearch++;
                                return {
                                    ...hit.attributes,
                                    document
                                };
                            });
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
                    postToSlack(
                        "#search-notifs",
                        `:rotating_light: [${domain}] [source: ${chatSource}] [languageModel: ${activeLanguageModel}] [provider: ${activeModelProvider}] [conversationId: ${conversationId}] \`Ask AI\` encountered a ${errorKind}: \`${errorString}\``
                    );
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
                        numCodeSearchResults: toolCallDocumentCounts.codeSearch,
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

            writer.merge(result.toUIMessageStream());
        }
    });

    return createUIMessageStreamResponse({ stream: uiMessageStream });
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
