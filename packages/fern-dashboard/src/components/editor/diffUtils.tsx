"use client";

import { type Change, diffChars } from "diff";

/** Splits a change value into lines, handling trailing newline. */
function splitChangeIntoLines(value: string): string[] {
    const lines = value.split("\n");
    if (lines.length > 0 && lines[lines.length - 1] === "") {
        lines.pop();
    }
    return lines;
}

/** Thin wrapper re-exporting `diffChars` from the "diff" library. */
function computeCharChanges(oldText: string, newText: string): Change[] {
    return diffChars(oldText, newText);
}

export interface ProcessedDiffLine {
    type: "added" | "removed" | "context";
    text: string;
    charChanges?: Change[];
}

/**
 * Processes raw diff changes into display-ready lines with character-level highlighting.
 * Adjacent removed+added chunks are paired to compute character-level diffs within each line.
 *
 * @param includeContext - If true, includes unchanged lines (for full diff view). If false, only changed lines (for preview).
 */
export function processDiffChanges(diffChanges: Change[], includeContext = false): ProcessedDiffLine[] {
    const lines: ProcessedDiffLine[] = [];

    for (let i = 0; i < diffChanges.length; i++) {
        const change = diffChanges[i];
        if (!change) {
            continue;
        }

        const textLines = splitChangeIntoLines(change.value);

        if (!change.added && !change.removed) {
            if (includeContext) {
                for (const text of textLines) {
                    lines.push({ type: "context", text });
                }
            }
            continue;
        }

        const nextChange = diffChanges[i + 1];

        // Pair removed+added chunks for character-level diff
        if (change.removed && nextChange?.added) {
            const removedLines = textLines;
            const addedLines = splitChangeIntoLines(nextChange.value);
            const pairCount = Math.min(removedLines.length, addedLines.length);

            for (let j = 0; j < pairCount; j++) {
                const oldText = removedLines[j] as string;
                const newText = addedLines[j] as string;
                const charChanges = computeCharChanges(oldText, newText);
                const hasChanges = charChanges.some((p) => p.added || p.removed);

                lines.push({ type: "removed", text: oldText, charChanges: hasChanges ? charChanges : undefined });
                lines.push({ type: "added", text: newText, charChanges: hasChanges ? charChanges : undefined });
            }

            // Unpaired lines
            for (let j = pairCount; j < removedLines.length; j++) {
                lines.push({ type: "removed", text: removedLines[j] as string });
            }
            for (let j = pairCount; j < addedLines.length; j++) {
                lines.push({ type: "added", text: addedLines[j] as string });
            }

            i++; // Skip next change (already processed)
        } else {
            const type = change.added ? "added" : "removed";
            for (const text of textLines) {
                lines.push({ type, text });
            }
        }
    }

    return lines;
}

export interface HighlightRange {
    start: number;
    end: number;
}

/**
 * Builds highlight ranges from character changes for either the added or removed view.
 * Returns the assembled text and the ranges to highlight.
 */
export function buildHighlightRanges(
    charChanges: Change[],
    showAdded: boolean
): { text: string; highlights: HighlightRange[] } {
    let text = "";
    const highlights: HighlightRange[] = [];

    for (const part of charChanges) {
        // Skip parts that don't apply to this view
        if ((showAdded && part.removed) || (!showAdded && part.added)) {
            continue;
        }
        const start = text.length;
        text += part.value;
        if (part.added || part.removed) {
            highlights.push({ start, end: text.length });
        }
    }

    return { text, highlights };
}

/** Renders text with highlighted spans for diff visualization. */
export function HighlightedText({
    text,
    highlights,
    showAdded
}: {
    text: string;
    highlights: HighlightRange[];
    showAdded: boolean;
}) {
    if (highlights.length === 0) {
        return <span>{text}</span>;
    }

    const parts: Array<{ text: string; highlighted: boolean }> = [];
    let pos = 0;
    for (const h of highlights) {
        if (h.start > pos) {
            parts.push({ text: text.slice(pos, h.start), highlighted: false });
        }
        parts.push({ text: text.slice(h.start, h.end), highlighted: true });
        pos = h.end;
    }
    if (pos < text.length) {
        parts.push({ text: text.slice(pos), highlighted: false });
    }

    return parts.map((part, i) => (
        <span key={i} className={part.highlighted ? (showAdded ? "bg-green-900/50" : "bg-red-900/50") : ""}>
            {part.text}
        </span>
    ));
}
