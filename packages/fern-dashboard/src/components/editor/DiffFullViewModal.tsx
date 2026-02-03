"use client";

import type { Change } from "diff";
import { forwardRef, useEffect, useMemo, useRef } from "react";

import { Dialog, DialogBody, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

import { buildHighlightRanges, HighlightedText, type ProcessedDiffLine, processDiffChanges } from "./diffUtils";

type UnifiedDiffLine = ProcessedDiffLine & { oldLine?: number; newLine?: number };

interface DiffFullViewModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    filename: string;
    diffChanges: Change[];
}

export function DiffFullViewModal({ open, onOpenChange, filename, diffChanges }: DiffFullViewModalProps) {
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const firstChangeRef = useRef<HTMLTableRowElement>(null);
    const prevOpenRef = useRef(false);

    const lastValidDataRef = useRef({ filename, diffChanges });
    if (open && (diffChanges.length > 0 || filename)) {
        lastValidDataRef.current = { filename, diffChanges };
    }
    const displayData = open ? { filename, diffChanges } : lastValidDataRef.current;

    const { unifiedLines, stats, firstChangeIndex } = useMemo(() => {
        const processed = processDiffChanges(displayData.diffChanges, true);
        let oldLineNum = 1,
            newLineNum = 1,
            added = 0,
            removed = 0,
            firstIdx = -1;

        const lines: UnifiedDiffLine[] = processed.map((line, i) => {
            const result: UnifiedDiffLine = { ...line };
            if (line.type === "context") {
                result.oldLine = oldLineNum++;
                result.newLine = newLineNum++;
            } else if (line.type === "removed") {
                result.oldLine = oldLineNum++;
                removed++;
                if (firstIdx === -1) {
                    firstIdx = i;
                }
            } else {
                result.newLine = newLineNum++;
                added++;
                if (firstIdx === -1) {
                    firstIdx = i;
                }
            }
            return result;
        });

        return { unifiedLines: lines, stats: { added, removed }, firstChangeIndex: firstIdx };
    }, [displayData.diffChanges]);

    // Scroll to first change when modal opens
    useEffect(() => {
        const wasOpen = prevOpenRef.current;
        prevOpenRef.current = open;

        if (!wasOpen && open && firstChangeIndex !== -1) {
            const timer = setTimeout(() => {
                const container = scrollContainerRef.current;
                const row = firstChangeRef.current;
                if (!container || !row) {
                    return;
                }
                const containerRect = container.getBoundingClientRect();
                const rowRect = row.getBoundingClientRect();
                const rowTopRelativeToContainer = rowRect.top - containerRect.top + container.scrollTop;
                const scrollTop = rowTopRelativeToContainer - container.clientHeight / 2 + row.offsetHeight / 2;
                container.scrollTop = Math.max(0, scrollTop);
            }, 100);
            return () => clearTimeout(timer);
        }
        return undefined;
    }, [open, firstChangeIndex]);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="md:max-w-4xl" onOpenAutoFocus={(e) => e.preventDefault()}>
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-3">
                        <span className="text-base">/{displayData.filename}</span>
                        <span className="flex items-center gap-1 text-sm font-normal">
                            {stats.added > 0 && <span className="font-mono text-green-1100">+{stats.added}</span>}
                            {stats.removed > 0 && <span className="font-mono text-red-600">-{stats.removed}</span>}
                        </span>
                    </DialogTitle>
                </DialogHeader>
                <DialogBody className="p-3">
                    {unifiedLines.length === 0 ? (
                        <div className="px-4 py-8 text-center text-sm text-white/50 bg-black rounded-md">
                            No changes
                        </div>
                    ) : (
                        <div ref={scrollContainerRef} className="max-h-[60vh] overflow-auto rounded-md bg-black py-2">
                            <table className="w-full border-collapse font-mono text-xs">
                                <tbody>
                                    {unifiedLines.map((line, idx) => (
                                        <DiffLine
                                            key={idx}
                                            line={line}
                                            ref={idx === firstChangeIndex ? firstChangeRef : undefined}
                                        />
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </DialogBody>
            </DialogContent>
        </Dialog>
    );
}

const DiffLine = forwardRef<HTMLTableRowElement, { line: UnifiedDiffLine }>(function DiffLine({ line }, ref) {
    const prefix = line.type === "added" ? "+" : line.type === "removed" ? "-" : " ";

    const rowBg = line.type === "added" ? "bg-green-900/30" : line.type === "removed" ? "bg-red-900/30" : "";
    const color = line.type === "added" ? "text-green-400" : line.type === "removed" ? "text-red-400" : "text-gray-500";

    const content =
        line.type !== "context" && line.charChanges
            ? (() => {
                  const showAdded = line.type === "added";
                  const { text, highlights } = buildHighlightRanges(line.charChanges, showAdded);
                  return <HighlightedText text={text} highlights={highlights} showAdded={showAdded} />;
              })()
            : line.text;

    const gutterClass = `w-10 min-w-10 select-none border-r border-white/10 px-2 py-0.5 text-right ${color}`;

    return (
        <tr ref={ref} className={rowBg}>
            <td className={gutterClass}>{line.type !== "added" ? line.oldLine : ""}</td>
            <td className={gutterClass}>{line.type !== "removed" ? line.newLine : ""}</td>
            <td className={`whitespace-pre-wrap break-all py-0.5 pl-2 pr-3 ${color}`}>
                <span className="select-none">{prefix} </span>
                {content}
            </td>
        </tr>
    );
});
