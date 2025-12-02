import { createOpenAI } from "@ai-sdk/openai";
import { createCachedDocsLoader } from "@fern-api/docs-loader";
import { isPosthogFeatureFlagEnabled } from "@fern-api/docs-server/analytics/posthog";
import { createGetAuthStateEdge } from "@fern-api/docs-server/auth/getAuthStateEdge";
import { fernToken_admin, getFaiChatUrl, getFaiOrigin, openaiApiKey } from "@fern-api/docs-server/env-variables";
import { getDocsUrlMetadata } from "@fern-api/docs-server/getDocsUrlMetadata";
import { isLocal } from "@fern-api/docs-server/isLocal";
import { isSelfHosted } from "@fern-api/docs-server/isSelfHosted";
import { getDocsDomainEdge } from "@fern-api/docs-server/xfernhost/edge";
import {
    getLanguageModel,
    getQueryIndexName,
    getTurbopufferNamespace,
    measureAsync,
    runRouteForAnthropic,
    runRouteForCohere,
    type TurbopufferAuthError
} from "@fern-docs/search-ask-fern";
import type { FacetFilter } from "@fern-docs/search-keyword";
import { MAX_AI_CHAT_MESSAGE_LENGTH } from "@fern-docs/search-ui";
import { createDelimitedRolesetCombinations } from "@fern-docs/search-utils";
import type { UIMessage } from "ai";
import { type NextRequest, NextResponse } from "next/server";

import { getFaiClient } from "@/getFaiClient";

export const maxDuration = 60;
export const revalidate = 0;

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

const FAI_CHAT_MIGRATION_FLAG_KEY = "fai-chat-endpoint-migration-enabled";

async function proxyToFaiChat(req: NextRequest, domain: string, host: string): Promise<NextResponse> {
    const originalBodyText = await req.text();
    let forwardedBody = originalBodyText;

    try {
        const parsedBody = JSON.parse(originalBodyText || "{}");
        const loader = await createCachedDocsLoader(host, domain);
        const config = await loader.getConfig();
        const model = config.aiChatConfig?.model;
        const customerSystemPrompt = config.aiChatConfig?.systemPrompt;

        if (model != null || customerSystemPrompt != null) {
            forwardedBody = JSON.stringify({
                ...parsedBody,
                model: model,
                customerSystemPrompt: customerSystemPrompt
            });
        }
    } catch (error) {
        console.error("FAI chat proxy: failed to augment request with aiChatConfig", error);
    }

    try {
        const response = await fetch(getFaiChatUrl(), {
            method: "POST",
            headers: {
                "Content-Type": req.headers.get("content-type") ?? "application/json",
                "x-fern-host": domain
            },
            body: forwardedBody,
            cache: "no-store",
            signal: req.signal
        });

        if (!response.ok) {
            return NextResponse.json({ error: "Failed to fetch from FAI chat service" }, { status: response.status });
        }

        if (!response.body) {
            return NextResponse.json({ error: "No response body from FAI chat service" }, { status: 500 });
        }

        return new NextResponse(response.body, {
            status: response.status,
            headers: {
                "Content-Type": response.headers.get("Content-Type") || "text/event-stream",
                "Cache-Control": "no-cache",
                Connection: "keep-alive",
                "X-Accel-Buffering": "no"
            }
        });
    } catch (error) {
        console.error("FAI chat proxy error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    if (isLocal() || isSelfHosted()) {
        return NextResponse.json("Ask Fern is not available in local preview mode or self-hosted mode", {
            status: 400
        });
    }
    const createdAt = new Date();
    const host = req.nextUrl.host;
    const domain = getDocsDomainEdge(req);

    const isMigrationEnabled = await isPosthogFeatureFlagEnabled(FAI_CHAT_MIGRATION_FLAG_KEY, domain);
    if (isMigrationEnabled) {
        return proxyToFaiChat(req, domain, host);
    }

    const [authState, authDurationMs] = await measureAsync(async () => {
        const { getAuthState } = await createGetAuthStateEdge(req);
        return getAuthState(req.nextUrl.pathname);
    });
    // if (!authState.ok) {
    //     return NextResponse.json("Unauthorized", { status: 401 });
    // }

    const roles = authState.authed ? (authState.user.roles ?? []) : [];
    const explodedRoles = createDelimitedRolesetCombinations({ roleset: roles });

    const [{ loader, metadata }, loaderDurationMs] = await measureAsync(async () => {
        const loader = await createCachedDocsLoader(host, domain);
        const metadata = await getDocsUrlMetadata(domain);
        return { loader, metadata };
    });

    if (metadata == null) {
        return NextResponse.json("Not found", { status: 404 });
    }

    if (metadata.isPreview && !metadata.enableAlgoliaOnPreview) {
        return NextResponse.json("Chat is not enabled for preview environments", {
            status: 404
        });
    }

    const faiClient = getFaiClient({
        token: fernToken_admin(),
        baseUrl: getFaiOrigin()
    });

    const [isAskAiEnabled, settingsFetchDurationMs] = await measureAsync(
        async () => (await faiClient.settings.getDocsSettings({ domain })).ask_ai_enabled
    );

    if (!isAskAiEnabled) {
        return NextResponse.json("Ask AI is not enabled for this domain", {
            status: 404
        });
    }

    const {
        messages,
        source,
        filters,
        conversationId,
        queryId,
        documentUrls,
        skipSaveQuery
    }: {
        url: string;
        messages: UIMessage[];
        source: string;
        filters: FacetFilter[];
        conversationId: string;
        queryId: string;
        documentUrls: string[];
        skipSaveQuery?: boolean;
    } = await req.json();

    const lastUserMessage = getLastUserMessage(messages);
    if (lastUserMessage.length > MAX_AI_CHAT_MESSAGE_LENGTH) {
        return NextResponse.json(`User message exceeds maximum length of ${MAX_AI_CHAT_MESSAGE_LENGTH} characters`, {
            status: 400
        });
    }

    const [config, configLoadDurationMs] = await measureAsync(() => loader.getConfig());

    const chatSource = source ?? "CHAT";

    const modelId = config.aiChatConfig?.model ?? "claude-3.5";
    const { model: languageModel, provider: modelProvider } = getLanguageModel(modelId);

    const openai = createOpenAI({ apiKey: openaiApiKey() });
    const embeddingModel = openai.embedding("text-embedding-3-large");

    let queryCreationDurationMs = 0;
    if (!skipSaveQuery) {
        try {
            const [, duration] = await measureAsync(() =>
                faiClient.query.createQuery({
                    domain,
                    body: {
                        domain,
                        text: lastUserMessage,
                        role: "USER",
                        source: chatSource.toUpperCase(),
                        created_at: createdAt.toISOString(),
                        time_to_first_token: undefined,
                        query_id: queryId,
                        conversation_id: conversationId
                    }
                })
            );
            queryCreationDurationMs = duration;
        } catch (error) {
            console.error("Error creating query", error);
        }
    }

    const queryIndexName = getQueryIndexName();
    let result: Response | TurbopufferAuthError;

    const routeMetrics = {
        authDurationMs,
        loaderDurationMs,
        settingsFetchDurationMs,
        configLoadDurationMs,
        queryCreationDurationMs
    };

    if (modelProvider === "bedrock") {
        result = await runRouteForAnthropic({
            domain,
            chatSource,
            promptTemplate: config.aiChatConfig?.systemPrompt,
            conversationId,
            lastUserMessage,
            messages,
            filters,
            explodedRoles,
            embeddingModel,
            turbopufferNamespace: getTurbopufferNamespace(domain, queryIndexName),
            languageModel,
            documentUrls,
            userIsAuthed: authState.authed,
            skipSaveQuery,
            routeMetrics
        });
    } else if (modelProvider === "cohere") {
        result = await runRouteForCohere({
            domain,
            chatSource,
            promptTemplate: config.aiChatConfig?.systemPrompt,
            conversationId,
            lastUserMessage,
            messages,
            filters,
            explodedRoles,
            embeddingModel,
            turbopufferNamespace: getTurbopufferNamespace(domain, queryIndexName),
            languageModel,
            userIsAuthed: authState.authed,
            skipSaveQuery,
            routeMetrics
        });
    } else {
        return NextResponse.json(`Invalid model provider: ${modelProvider}`, {
            status: 400
        });
    }

    // Unauthorized error
    if (result && isAuthError(result)) {
        return createAuthErrorStreamResponse(result.message);
    }

    return result;
}

function createAuthErrorStreamResponse(errorMessage: string): NextResponse {
    const assistantQueryId = crypto.randomUUID();
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
        start(controller) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "data-sources", data: [] })}\n\n`));
            controller.enqueue(
                encoder.encode(
                    `data: ${JSON.stringify({ type: "data-assistant-query-id", data: assistantQueryId })}\n\n`
                )
            );
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "start" })}\n\n`));
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "start-step" })}\n\n`));
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "text-start", id: "0" })}\n\n`));
            controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ type: "text-delta", id: "0", delta: errorMessage })}\n\n`)
            );
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "text-end", id: "0" })}\n\n`));
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "finish-step" })}\n\n`));
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "finish" })}\n\n`));
            controller.enqueue(encoder.encode(`data: [DONE]\n\n`));
            controller.close();
        }
    });

    return new NextResponse(stream, {
        headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            Connection: "keep-alive"
        }
    });
}

function getLastUserMessage(messages: UIMessage[]): string {
    let lastUserMessageText = "";
    const lastUserMessage = messages.findLast((message: UIMessage, _: number) => {
        return message.role === "user";
    });

    if (lastUserMessage == null) {
        return "";
    }

    for (const part of lastUserMessage.parts) {
        if (part.type === "text") {
            lastUserMessageText += part.text;
        }
    }
    return lastUserMessageText;
}

function isAuthError(result: Response | TurbopufferAuthError): result is TurbopufferAuthError {
    return Array.isArray(result) === false && "error" in result && result.error === "unauthorized";
}
