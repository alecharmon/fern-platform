"use client";

import {
    CheckCircleIcon,
    ChevronDownIcon,
    CircleDotIcon,
    CircleIcon,
    Loader2Icon,
    LockIcon,
    XCircleIcon
} from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/utils/utils";
import type { ChecklistItemStatus } from "./domainSetupStateMachine";

interface ChecklistItemProps {
    title: string;
    status: ChecklistItemStatus;
    lockedMessage?: string;
    expanded: boolean;
    onToggle: () => void;
    children: ReactNode;
}

const statusIcons: Record<ChecklistItemStatus, ReactNode> = {
    locked: <LockIcon className="size-4 text-muted-foreground/50" />,
    "not-started": <CircleIcon className="size-4 text-muted-foreground" />,
    "in-progress": <Loader2Icon className="size-4 animate-spin text-primary" />,
    waiting: <CircleDotIcon className="size-4 text-muted-foreground" />,
    complete: <CheckCircleIcon className="size-4 text-green-600 dark:text-green-400" />,
    failed: <XCircleIcon className="size-4 text-red-600 dark:text-red-400" />
};

export function ChecklistItem({ title, status, lockedMessage, expanded, onToggle, children }: ChecklistItemProps) {
    const isLocked = status === "locked";
    const isComplete = status === "complete";
    const isInteractive = !isLocked && !isComplete;

    return (
        <div
            className={cn(
                "rounded-lg border border-border transition-colors",
                status === "in-progress" && "border-primary/40",
                isComplete && "border-green-200 dark:border-green-800",
                status === "failed" && "border-red-200 dark:border-red-800",
                isLocked && "opacity-60"
            )}
        >
            <button
                type="button"
                onClick={isInteractive ? onToggle : undefined}
                disabled={!isInteractive}
                className={cn(
                    "flex w-full items-center gap-3 px-4 py-3 text-left text-sm font-medium",
                    isInteractive && "cursor-pointer hover:bg-muted/50",
                    !isInteractive && "cursor-default"
                )}
            >
                {statusIcons[status]}
                <span className="flex-1">{title}</span>
                {isLocked ? (
                    <span className="text-xs text-muted-foreground">
                        {lockedMessage ?? "Complete previous steps first"}
                    </span>
                ) : !isComplete ? (
                    <ChevronDownIcon
                        className={cn("size-4 text-muted-foreground transition-transform", expanded && "rotate-180")}
                    />
                ) : null}
            </button>

            {expanded && isInteractive && <div className="border-t border-border px-4 py-4">{children}</div>}
        </div>
    );
}
