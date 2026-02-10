import { ArrowUpRightIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ExportStatusBadge } from "./ExportStatusBadge";
import type { ExportTask } from "./types";

function formatElapsedMmSs(totalSeconds: number) {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = Math.max(0, totalSeconds % 60);
    return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function formatBytes(bytes: number | undefined) {
    if (bytes == null) {
        return "";
    }
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
    const startedAtMs = task.startedAt ? Date.parse(task.startedAt) : undefined;
    const elapsedSeconds = isRunning && startedAtMs != null ? Math.floor((nowMs - startedAtMs) / 1000) : undefined;

    return (
        <div className="flex flex-col bg-background transition-colors hover:bg-muted/50">
            {/* Main row */}
            <div className="flex items-center gap-4 p-4">
                {/* Status badge - fixed width */}
                <div className="w-28 shrink-0">
                    <ExportStatusBadge status={task.status} />
                </div>

                {/* Date - fixed width */}
                <div className="flex w-32 shrink-0 flex-col gap-0.5">
                    {isRunning ? (
                        <>
                            <span className="text-sm font-medium text-gray-1100">
                                {formatElapsedMmSs(Math.max(0, elapsedSeconds ?? 0))}
                            </span>
                            <span className="text-xs text-muted-foreground">elapsed</span>
                        </>
                    ) : (
                        <>
                            <span className="text-sm font-medium text-gray-1100">{formattedDate}</span>
                            <span className="text-xs text-muted-foreground">{formattedTime}</span>
                        </>
                    )}
                </div>

                {/* File info - flexible */}
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    {task.status === "COMPLETED" && task.fileName && (
                        <>
                            <span className="truncate text-sm text-gray-1100">{task.fileName}</span>
                            <span className="text-xs text-muted-foreground">
                                {task.sizeBytes ? formatBytes(task.sizeBytes) : ""}
                            </span>
                        </>
                    )}
                </div>

                {/* Action - fixed width */}
                <div className="flex w-20 shrink-0 items-center justify-end">
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

            {/* Error message row (if applicable) */}
            {hasError && (
                <div className="border-t border-dashed border-red-300 bg-red-50 px-4 py-2 dark:border-red-800 dark:bg-red-950/30">
                    <span className="text-xs text-red-700 dark:text-red-400">{task.errorMessage}</span>
                </div>
            )}

            {/* Queued message row */}
            {isQueued && (
                <div className="border-t border-dashed border-gray-300 bg-gray-50 px-4 py-2 dark:border-gray-700 dark:bg-gray-900/30">
                    <span className="text-xs text-gray-1100">Your export is queued and will start shortly.</span>
                </div>
            )}

            {/* Running message row */}
            {isRunning && (
                <div className="border-t border-dashed border-blue-300 bg-blue-50 px-4 py-2 dark:border-blue-800 dark:bg-blue-950/30">
                    <span className="text-xs text-gray-1100">
                        You can safely close this page — we'll keep working and your export will appear here when it's
                        ready.
                    </span>
                </div>
            )}
        </div>
    );
}
