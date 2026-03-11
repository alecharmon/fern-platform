import type { ActivityLogEntry } from "./types.js";

export function calculateCredits(entry: ActivityLogEntry): number {
    return entry.metadata.response_tokens;
}
