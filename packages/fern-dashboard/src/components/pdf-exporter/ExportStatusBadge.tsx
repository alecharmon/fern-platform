import { Loader2Icon } from "lucide-react";
import { cn } from "@/utils/utils";
import type { ExportTaskStatus } from "./types";

export interface ExportStatusBadgeProps {
    status: ExportTaskStatus;
}

export function ExportStatusBadge({ status }: ExportStatusBadgeProps) {
    const config: Record<
        ExportTaskStatus,
        { label: string; containerClass: string; dotClass: string; textClass: string }
    > = {
        PENDING: {
            label: "Queued",
            containerClass: "bg-gray-300 border border-gray-500",
            dotClass: "bg-gray-900",
            textClass: "text-gray-900"
        },
        RUNNING: {
            label: "Exporting",
            containerClass: "bg-blue-200 border border-blue-900",
            dotClass: "", // Uses spinner instead
            textClass: "text-blue-900"
        },
        COMPLETED: {
            label: "Completed",
            containerClass: "bg-green-300 border border-green-1100",
            dotClass: "bg-green-1100",
            textClass: "text-green-1100"
        },
        FAILED: {
            label: "Failed",
            containerClass: "bg-red-200 border border-red-700",
            dotClass: "bg-red-700",
            textClass: "text-red-700"
        }
    };
    const c = config[status];
    return (
        <div className={cn("inline-flex shrink-0 items-center gap-2 rounded-full px-3 py-1.5", c.containerClass)}>
            {status === "RUNNING" ? (
                <Loader2Icon className="size-3.5 animate-spin text-blue-900" />
            ) : (
                <div className={cn("size-2 rounded-full", c.dotClass)} />
            )}
            <span className={cn("text-sm font-medium leading-none", c.textClass)}>{c.label}</span>
        </div>
    );
}
