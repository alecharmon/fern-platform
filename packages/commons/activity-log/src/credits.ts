import type { ActivityLogEntry } from "./types.js";

/** Static credit cost for each ask_fern message (charged per message). */
export const ASK_FERN_CREDITS_PER_MESSAGE = 2;

const FERN_WRITER_SESSION_CREDITS = 50;

export function calculateCredits(entry: ActivityLogEntry): number {
    switch (entry.type) {
        case "ask_fern":
            return ASK_FERN_CREDITS_PER_MESSAGE;
        case "fern_writer":
            return FERN_WRITER_SESSION_CREDITS;
    }
}
