import type { ActivityLogEntry } from "./types.js";

/** Static credit cost for each ask_fern conversation (charged once per conversation). */
export const ASK_FERN_CREDITS_PER_CONVERSATION = 2;

/** Dedup window for Ask Fern conversations — conversations older than this are billed separately */
export const ASK_FERN_CONVERSATION_DEDUP_WINDOW_MS = 24 * 60 * 60 * 1000;

export function calculateCredits(entry: ActivityLogEntry): number {
    if (entry.type === "ask_fern") {
        return ASK_FERN_CREDITS_PER_CONVERSATION;
    }
    return entry.metadata.response_tokens;
}
