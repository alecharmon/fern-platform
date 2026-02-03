"use client";

import type { Change } from "diff";

import { DiffLineContent } from "./DiffLineContent";
import { processDiffChanges } from "./diffUtils";

const MAX_LINES = 12;
const MAX_LINE_LENGTH = 40;

interface DiffPreviewContentProps {
    diffChanges: Change[];
    maxLines?: number;
    onViewAll?: () => void;
}

export function DiffPreviewContent({ diffChanges, maxLines = MAX_LINES, onViewAll }: DiffPreviewContentProps) {
    const processedLines = processDiffChanges(diffChanges, false);
    if (processedLines.length === 0) {
        return null;
    }

    const visibleLines = maxLines > 0 ? processedLines.slice(0, maxLines) : processedLines;

    return (
        <div className="rounded-md bg-black p-3 text-left">
            <div className="space-y-0.5 font-mono text-xs">
                {visibleLines.map((line, idx) => (
                    <DiffLineContent key={idx} line={line} maxLength={MAX_LINE_LENGTH} />
                ))}
            </div>
            <div className="border-t text-white/25 my-2" />
            <button
                type="button"
                onClick={onViewAll}
                className="cursor-pointer text-xs text-white/75 hover:text-white py-1"
            >
                View all changes →
            </button>
        </div>
    );
}
