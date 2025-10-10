import { type NextRequest, NextResponse } from "next/server";

import { createOpenAI } from "@ai-sdk/openai";
import type { UIMessage } from "ai";

import { createCachedDocsLoader } from "@fern-api/docs-loader";
import { getDocsUrlMetadata } from "@fern-api/docs-server/getDocsUrlMetadata";
import { createGetAuthStateEdge } from "@fern-api/docs-server/auth/getAuthStateEdge";
import { fernToken_admin, openaiApiKey } from "@fern-api/docs-server/env-variables";
import { isLocal } from "@fern-api/docs-server/isLocal";
import { isSelfHosted } from "@fern-api/docs-server/isSelfHosted";
import { getDocsDomainEdge } from "@fern-api/docs-server/xfernhost/edge";
import {
    getLanguageModel,
    getQueryIndexName,
    getTurbopufferNamespace,
    runRouteForAnthropic,
    runRouteForCohere,
    type TurbopufferAuthError
} from "@fern-docs/search-ask-fern";
import type { FacetFilter } from "@fern-docs/search-keyword";
import { MAX_AI_CHAT_MESSAGE_LENGTH } from "@fern-docs/search-ui";
import { createDelimitedRolesetCombinations } from "@fern-docs/search-utils";

import { getFaiClient } from "@/getFaiClient";

export const maxDuration = 60;
export const revalidate = 0;

export async function POST(req: NextRequest) {
    if (isLocal() || isSelfHosted()) {
        return NextResponse.json("Ask Fern is not available in local preview mode or self-hosted mode", {
            status: 400
        });
    }
    const createdAt = new Date();
    const host = req.nextUrl.host;
    const domain = getDocsDomainEdge(req);

    const { getAuthState } = await createGetAuthStateEdge(req);
    const authState = await getAuthState(req.nextUrl.pathname);
    // if (!authState.ok) {
    //     return NextResponse.json("Unauthorized", { status: 401 });
    // }

    const roles = authState.authed ? (authState.user.roles ?? []) : [];
    const explodedRoles = createDelimitedRolesetCombinations({ roleset: roles });

    const loader = await createCachedDocsLoader(host, domain);
    const metadata = await getDocsUrlMetadata(domain);

    if (metadata == null) {
        return NextResponse.json("Not found", { status: 404 });
    }

    if (metadata.isPreview && !metadata.enableAlgoliaOnPreview) {
        return NextResponse.json("Chat is not enabled for preview environments", {
            status: 404
        });
    }

    const faiClient = getFaiClient({
        token: fernToken_admin()
    });

    const isAskAiEnabled = (await faiClient.settings.getSettings({ domain })).ask_ai_enabled;

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
        documentUrls
    }: {
        url: string;
        messages: UIMessage[];
        source: string;
        filters: FacetFilter[];
        conversationId: string;
        queryId: string;
        documentUrls: string[];
    } = await req.json();

    const lastUserMessage = getLastUserMessage(messages);
    if (lastUserMessage.length > MAX_AI_CHAT_MESSAGE_LENGTH) {
        return NextResponse.json(`User message exceeds maximum length of ${MAX_AI_CHAT_MESSAGE_LENGTH} characters`, {
            status: 400
        });
    }

    const config = await loader.getConfig();
    const chatSource = source ?? "CHAT";

    const modelId = config.aiChatConfig?.model ?? "claude-3.5";
    const { model: languageModel, provider: modelProvider } = getLanguageModel(modelId);

    const openai = createOpenAI({ apiKey: openaiApiKey() });
    const embeddingModel = openai.embedding("text-embedding-3-large");

    try {
        await faiClient.query.createQuery({
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
        });
    } catch (error) {
        console.log("Error creating query", error);
    }

    const queryIndexName = getQueryIndexName();
    let result: Response | TurbopufferAuthError;

    if (modelProvider === "anthropic" || modelProvider === "bedrock") {
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
            userIsAuthed: authState.authed
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
            userIsAuthed: authState.authed
        });
    } else {
        return NextResponse.json(`Invalid model provider: ${modelProvider}`, {
            status: 400
        });
    }

    // Unauthorized error
    if (result && typeof result === "object" && "error" in result && result.error === "unauthorized") {
        return createAuthErrorStreamResponse(result.message);
    }

    return result;
}

function createAuthErrorStreamResponse(errorMessage: string): Response {
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

    return new Response(stream, {
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
