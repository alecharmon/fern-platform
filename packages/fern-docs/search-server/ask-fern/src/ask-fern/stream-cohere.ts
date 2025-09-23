import {
  EmbeddingModel,
  LanguageModel,
  ModelMessage,
  NoSuchToolError,
  UIMessage,
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  stepCountIs,
  streamText,
} from "ai";
import z from "zod";

import { postToSlack, track } from "@fern-api/docs-server";
import {
  fernToken_admin,
  getFaiOrigin,
} from "@fern-api/docs-server/env-variables";
import { FernAIClient } from "@fern-api/fai-sdk";
import { isNonNullish } from "@fern-api/ui-core-utils";
import { FacetFilter } from "@fern-docs/search-keyword";

import { convertTpufRecordToCitation, createChatSystemPrompt } from "../index";
import { runQueryTurbopuffer } from "./run-query-turbopuffer";

export async function runRouteForCohere({
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
}) {
  const start = Date.now();

  const searchResults = await runQueryTurbopuffer(lastUserMessage, {
    embeddingModel,
    namespace: turbopufferNamespace,
    topK: 3,
    filters,
    explodedRoles,
  });
  const searchResultSources = searchResults.map((hit) => {
    return {
      title: hit.attributes.title,
      url: hit.attributes.url,
    };
  });

  const systemPrompt = createChatSystemPrompt({
    modelProvider: "cohere",
    domain,
    date: new Date().toDateString(),
    documents: "",
    promptTemplate,
    availableTools: [],
  });

  const documents = convertTpufRecordToCitation(searchResults);
  const modelMessages: ModelMessage[] = messages
    .map((message: UIMessage) => {
      if (message.role === "user") {
        return {
          role: "user",
          content: [
            {
              type: "text",
              text: lastUserMessage,
            },
            ...documents,
          ],
        };
      }
      // TODO: file ticket with vercel (they don't handle content vs parts, which breaks citations)
      const convertedMessage = convertToModelMessages([message]);
      if (convertedMessage.length > 0) {
        return convertedMessage[0];
      } else {
        return undefined;
      }
    })
    .filter(isNonNullish) as ModelMessage[];

  let timeToFirstToken: number | undefined = undefined;
  let responseText = "";

  const assistantQueryId = crypto.randomUUID();

  const uiMessageStream = createUIMessageStream({
    execute({ writer }) {
      writer.write({
        type: "data-sources",
        data: searchResultSources,
      });

      writer.write({
        type: "data-assistant-query-id",
        data: assistantQueryId,
      });

      const result = streamText({
        model: languageModel,
        system: systemPrompt,
        messages: modelMessages,
        maxRetries: 3,
        stopWhen: stepCountIs(10),
        includeRawChunks: true,
        onChunk: (chunk) => {
          // handle cohere citation chunks
          const rawCitationChunk =
            rawCitationChunkFormatSchema.safeParse(chunk);
          if (rawCitationChunk.success) {
            const citation = rawCitationChunk.data.chunk.rawValue;
            writer.write({
              type: "data-citation",
              data: {
                url: citation.delta.message.citations.sources[0]?.document
                  .title,
                start: citation.delta.message.citations.start,
                end: citation.delta.message.citations.end,
                text: citation.delta.message.citations.text,
              },
            });
          }
          if (chunk.chunk.type === "text" && chunk.chunk.text.length > 0) {
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

          const msg = `encountered a ${errorKind} for query '${lastUserMessage}: ${JSON.stringify(error)}'`;
          console.error(msg);
          postToSlack(
            "#search-notifs",
            `:rotating_light: [${domain}] [source: ${chatSource}] [languageModel: ${JSON.stringify(languageModel)}] [conversationId: ${conversationId}] \`Ask AI\` encountered a ${errorKind}: \`${JSON.stringify(error)}\``
          );
        },
        onFinish: async (e) => {
          const end = Date.now();
          const faiClient = new FernAIClient({
            baseUrl: getFaiOrigin(),
            headers: {
              Authorization: `Bearer ${fernToken_admin()}`,
            },
          });
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
                time_to_first_token: timeToFirstToken,
              },
            });
          } catch (error) {
            console.log("Error creating assistant query", error);
          }
          track("ask_ai", {
            languageModel: languageModel.valueOf().toString(),
            embeddingModel: embeddingModel.modelId,
            durationMs: end - start,
            domain,
            namespace: turbopufferNamespace,
            numToolCalls: e.toolCalls.length,
            finishReason: e.finishReason,
            ...e.usage,
          });
          e.warnings?.forEach((warning) => {
            console.warn(warning);
          });
        },
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
        },
      });

      writer.merge(result.toUIMessageStream());
    },
  });

  return createUIMessageStreamResponse({ stream: uiMessageStream });
}

const rawCitationChunkFormatSchema = z.object({
  chunk: z.object({
    type: z.literal("raw"),
    rawValue: z.object({
      type: z.literal("citation-start"),
      index: z.number(),
      delta: z.object({
        message: z.object({
          citations: z.object({
            start: z.number(),
            end: z.number(),
            text: z.string(),
            type: z.string(),
            sources: z.array(
              z.object({
                type: z.string(),
                id: z.string(),
                document: z.union([
                  z.object({
                    id: z.string(),
                    text: z.string(),
                    title: z.string(),
                  }),
                  z.object({
                    type: z.literal("tool"),
                    id: z.string(),
                    title: z.string().optional(),
                    tool_output: z.object({
                      content: z.string(),
                    }),
                  }),
                ]),
              })
            ),
          }),
        }),
      }),
    }),
  }),
});
