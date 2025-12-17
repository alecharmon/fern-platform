import type { UIMessage } from "@ai-sdk/react";
import { isNonNullish } from "@fern-api/ui-core-utils";
import type { ToolUIPart, UIDataTypes, UIMessagePart, UITools } from "ai";
import { z } from "zod";

interface AskFernRecordHit {
    title?: string;
    url?: string;
}

const SearchResult = z.object({
    title: z.string(),
    url: z.string(),
    icon: z.string().optional(),
    type: z.string().optional(),
    api_type: z.string().optional()
});

export type SearchResult = z.infer<typeof SearchResult>;

export interface SqueezedMessage {
    user?: {
        id: string;
        createdAt?: Date;
        content: string;
        parts?: UIMessagePart<UIDataTypes, UITools>[]; // vercel does not export types
    };
    assistant?: {
        id: string;
        createdAt?: Date;
        content: string;
        citations?: {
            start: number;
            end: number;
            text: string;
            url: string;
        }[];
        sources?: SearchResult[];
        parts?: UIMessagePart<UIDataTypes, UITools>[]; // vercel does not export types
    };
}

// this is necessary to fix the discrepancy between claude 3.5 and 3.7
// claude 3.5 automatically adds new lines after tool invocations, specifically
// after the messages that say `Let me search for that...`
// claude 3.7 does not do this, which creates bad formatting in the UI
// this function ensures that message parts have new lines.
// hopefully this is a temporary fix that can be removed with better model behavior
export function ensureMessagePartsHaveNewLines(messages: UIMessage[]): UIMessage[] {
    return messages.map((message) => {
        if (message.role === "assistant") {
            let step = 0;
            if (message.parts) {
                message.parts = message.parts.map((part) => {
                    if (part.type === "step-start") {
                        step++;
                        return part;
                    } else if (part.type === "text") {
                        if (step > 1) {
                            if (!part.text.startsWith("\n")) {
                                part.text = "\n\n" + part.text;
                                return part;
                            } else {
                                return part;
                            }
                        }
                    }
                    return part;
                });
            }
            return message;
        } else {
            return message;
        }
    });
}

export function squeezeMessages(messages: UIMessage[]): SqueezedMessage[] {
    const squeezed: SqueezedMessage[] = [];

    for (const message of messages) {
        let lastMessage = squeezed[squeezed.length - 1];

        if (message.role === "user") {
            squeezed.push({
                user: {
                    id: message.id,
                    content: message.parts
                        ?.filter((part) => part.type === "text")
                        .map((part) => part.text)
                        .join(""),
                    parts: message.parts
                }
            });
        } else if (message.role === "assistant") {
            if (lastMessage == null) {
                const newMessage: SqueezedMessage = {};
                lastMessage = newMessage;
                squeezed.push(newMessage);
            }

            lastMessage.assistant ??= {
                id: message.id,
                content: "",
                citations: []
            };

            lastMessage.assistant.content = [
                lastMessage.assistant.content,
                message.parts
                    ?.filter((part) => part.type === "text")
                    .map((part) => part.text)
                    .join("")
            ]
                .filter((content) => content.trimStart().length > 0)
                .join("\n\n");

            const citationParts: CitationPart[] = message.parts
                ?.filter((part) => part.type === "data-citation")
                .map((part) => {
                    const parsedPart = citationPartSchema.safeParse(part);
                    if (parsedPart.success) {
                        return parsedPart.data;
                    } else {
                        return undefined;
                    }
                })
                .filter(isNonNullish);

            const sources: SearchResult[] = message.parts
                ?.filter((part) => part.type === "data-sources")
                .map((part) => {
                    if (part.type !== "data-sources") {
                        return undefined;
                    }
                    const parsedPart = sourcePartSchema.safeParse(part);
                    if (parsedPart.success) {
                        return parsedPart.data;
                    } else {
                        return undefined;
                    }
                })
                .filter(isNonNullish)
                .flatMap((part) => part.data);

            lastMessage.assistant.sources = sources;

            lastMessage.assistant.citations = lastMessage.assistant.citations?.concat(
                citationParts.map((part) => {
                    return {
                        start: part.data.start,
                        end: part.data.end,
                        text: part.data.text,
                        url: part.data.url
                    };
                })
            );

            lastMessage.assistant.parts = message.parts;
        }
    }

    return squeezed;
}

export function combineSearchResults(messages: SqueezedMessage[]): AskFernRecordHit[] {
    const toolUIParts: ToolUIPart[] = messages
        .flatMap((message) => message.assistant?.parts || [])
        .filter((part) => part.type === "tool-search" || part.type === "tool-output-available") as ToolUIPart[];

    const sources: SearchResult[] = messages.flatMap((message) => message.assistant?.sources || []);

    return toolUIParts
        .flatMap((part) => {
            return part.state === "output-available"
                ? typeof part.output === "string"
                    ? JSON.parse(part.output)
                    : part.output
                : undefined;
        })
        .map((part) => {
            return SearchResult.safeParse(part).data;
        })
        .concat(sources)
        .filter(isNonNullish);
}

const citationPartSchema = z.object({
    type: z.literal("data-citation"),
    data: z.object({
        start: z.number(),
        end: z.number(),
        text: z.string(),
        url: z.string()
    })
});

const sourcePartSchema = z.object({
    type: z.literal("data-sources"),
    data: z.array(SearchResult)
});

type CitationPart = z.infer<typeof citationPartSchema>;
