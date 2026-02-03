"use client";

import { buildHighlightRanges, HighlightedText, type HighlightRange, type ProcessedDiffLine } from "./diffUtils";

interface DiffLineContentProps {
    line: ProcessedDiffLine;
    maxLength?: number;
    contextBefore?: number;
}

export function DiffLineContent({ line, maxLength, contextBefore = 24 }: DiffLineContentProps) {
    if (line.type === "context") {
        return <span className="text-gray-400">{line.text}</span>;
    }

    const showAdded = line.type === "added";
    const textClass = showAdded ? "text-green-400" : "text-red-400";
    const prefix = showAdded ? "+ " : "- ";

    if (!line.charChanges) {
        const displayText = maxLength && line.text.length > maxLength ? `${line.text.slice(0, maxLength)}…` : line.text;
        return (
            <div className={textClass}>
                <span className="select-none">{prefix}</span>
                <span className="whitespace-pre-wrap break-all">{displayText}</span>
            </div>
        );
    }

    const { text, highlights } = buildHighlightRanges(line.charChanges, showAdded);
    let displayText = text;
    let adjustedHighlights: HighlightRange[] = highlights;

    // Truncate with smart windowing: center the window around the first change
    if (maxLength && (text.length > maxLength || (highlights[0]?.start ?? 0) > maxLength - 5)) {
        const firstChangePos = highlights[0]?.start ?? text.length;
        const windowStart = Math.max(0, firstChangePos - contextBefore);
        const windowEnd = windowStart + maxLength - (windowStart > 0 ? 2 : 1);
        displayText =
            (windowStart > 0 ? "…" : "") + text.slice(windowStart, windowEnd) + (windowEnd < text.length ? "…" : "");
        const offset = windowStart - (windowStart > 0 ? 1 : 0);
        adjustedHighlights = highlights
            .map((h) => ({ start: Math.max(0, h.start - offset), end: Math.min(displayText.length, h.end - offset) }))
            .filter((h) => h.end > 0 && h.start < displayText.length);
    }

    return (
        <div className={textClass}>
            <span className="select-none">{prefix}</span>
            <span className="whitespace-pre-wrap break-all">
                <HighlightedText text={displayText} highlights={adjustedHighlights} showAdded={showAdded} />
            </span>
        </div>
    );
}
