import { ArrowUpRightIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ExportStatusBadge } from "./ExportStatusBadge";
import type { ExportTask } from "./types";

function formatDurationMmSs(totalSeconds: number) {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = Math.max(0, totalSeconds % 60);
    return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function formatBytes(bytes: number) {
    const kb = bytes / 1024;
    if (kb < 1024) {
        return `${kb.toFixed(0)} KB`;
    }
    const mb = kb / 1024;
    return `${mb.toFixed(1)} MB`;
}

export interface ExportRowProps {
    task: ExportTask;
    nowMs: number;
    onOpen: (taskId: string) => void;
    isOpening: boolean;
}

export function ExportRow({ task, nowMs, onOpen, isOpening }: ExportRowProps) {
    const formattedDate = new Date(task.createdAt).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric"
    });
    const formattedTime = new Date(task.createdAt).toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit"
    });

    const hasError = task.status === "FAILED" && task.errorMessage;
    const isQueued = task.status === "PENDING";
    const isRunning = task.status === "RUNNING";
    const startedAtMs = task.startedAt != null ? Date.parse(task.startedAt) : undefined;
    const elapsedSeconds = isRunning && startedAtMs != null ? Math.floor((nowMs - startedAtMs) / 1000) : undefined;

    const completedDurationSeconds =
        task.status === "COMPLETED" && task.startedAt != null && task.completedAt != null
            ? Math.floor((Date.parse(task.completedAt) - Date.parse(task.startedAt)) / 1000)
            : undefined;

    const exportTimeLabel =
        isRunning && elapsedSeconds != null
            ? `Elapsed ${formatDurationMmSs(elapsedSeconds)}`
            : completedDurationSeconds != null
              ? `Done in ${formatDurationMmSs(completedDurationSeconds)}`
              : undefined;

    const productId = task.productId ?? undefined;
    const versionId = task.versionId ?? undefined;
    const hasScope = productId != null || versionId != null;

    const durationParts: string[] = [];
    if (task.status === "COMPLETED" && task.sizeBytes != null) {
        durationParts.push(formatBytes(task.sizeBytes));
    }
    const durationLabel = durationParts.join(" · ");

    return (
        <div className="flex flex-col bg-background transition-colors hover:bg-muted/50">
            <div className="flex items-start gap-5 p-4">
                <div className="w-28 shrink-0 self-center">
                    <ExportStatusBadge status={task.status} />
                </div>

                <div className="flex w-28 shrink-0 flex-col gap-0.5">
                    <span className="text-sm text-gray-1100">{formattedDate}</span>
                    <span className="text-xs text-muted-foreground">{formattedTime}</span>
                    {exportTimeLabel != null && (
                        <span className="text-xs text-muted-foreground whitespace-nowrap">{exportTimeLabel}</span>
                    )}
                </div>

                {/* Scope + duration details */}
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                    {hasScope ? (
                        <div className="flex min-w-0 items-start gap-4">
                            {productId != null && (
                                <div className="min-w-0 flex-1">
                                    <div className="text-xs text-muted-foreground">Product</div>
                                    <div className="truncate text-sm text-gray-1100">{productId}</div>
                                </div>
                            )}
                            {versionId != null && (
                                <div className="min-w-0 flex-1">
                                    <div className="text-xs text-muted-foreground">Version</div>
                                    <div className="truncate text-sm text-gray-1100">{versionId}</div>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="truncate text-sm text-gray-1100">Entire documentation</div>
                    )}

                    {durationLabel.length > 0 && <div className="text-xs text-muted-foreground">{durationLabel}</div>}
                </div>

                {/* Action */}
                <div className="shrink-0 self-center">
                    {task.status === "COMPLETED" && (
                        <Button
                            variant="outline"
                            size="sm"
                            className="gap-1.5"
                            disabled={isOpening}
                            onClick={() => onOpen(String(task.id))}
                        >
                            Open
                            <ArrowUpRightIcon className="size-3.5" />
                        </Button>
                    )}
                </div>
            </div>

            {hasError && (
                <div className="border-t border-dashed border-red-300 bg-red-50 px-4 py-2 dark:border-red-800 dark:bg-red-950/30">
                    <span className="text-xs text-red-700 dark:text-red-400">{task.errorMessage}</span>
                </div>
            )}

            {isQueued && (
                <div className="border-t border-dashed border-gray-300 bg-gray-50 px-4 py-2 dark:border-gray-700 dark:bg-gray-900/30">
                    <span className="text-xs text-gray-1100">Your export is queued and will start shortly.</span>
                </div>
            )}

            {isRunning && (
                <div className="border-t border-dashed border-blue-600 bg-blue-50 px-4 py-2 dark:border-blue-800 dark:bg-blue-950/30">
                    <span className="text-xs text-gray-1100">
                        You can safely close this page — we'll keep working and your export will appear here when it's
                        ready.
                    </span>
                </div>
            )}
        </div>
    );
}
