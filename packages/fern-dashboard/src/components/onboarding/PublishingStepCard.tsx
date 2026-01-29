"use client";

import { Loader2Icon } from "lucide-react";
import { type ReactNode, useEffect, useMemo, useState } from "react";

import { cn } from "@/utils/utils";
import { Button } from "../ui/button";

export type PublishingStepState = "not-started" | "in-progress" | "complete";

interface PublishingStepCardProps {
    title: string;
    state: PublishingStepState;
    icon: ReactNode;
    loadingMessages?: string[];
    waitingMessage?: string;
    completeMessage?: string | null;
    completeActionLabel?: string;
    inProgressActionLabel?: string;
    completeActionUrl?: string;
    isActionDisabled?: boolean;
    onActionClick?: () => void;
}

export function PublishingStepCard({
    title,
    state,
    icon,
    loadingMessages = [],
    waitingMessage,
    completeMessage = null,
    completeActionLabel,
    inProgressActionLabel,
    completeActionUrl,
    isActionDisabled = false,
    onActionClick
}: PublishingStepCardProps) {
    const [loadingIndex, setLoadingIndex] = useState(0);
    const hasMultipleMessages = loadingMessages.length > 1;

    useEffect(() => {
        if (state !== "in-progress" || !hasMultipleMessages) {
            return;
        }

        const interval = window.setInterval(() => {
            setLoadingIndex((prev) => (prev + 1) % loadingMessages.length);
        }, 2500);

        return () => {
            window.clearInterval(interval);
        };
    }, [state, hasMultipleMessages, loadingMessages]);

    useEffect(() => {
        if (state === "not-started") {
            setLoadingIndex(0);
        }
    }, [state]);

    const progressCopy = useMemo(() => {
        if (state === "complete") {
            return completeMessage;
        }

        if (state === "in-progress") {
            if (loadingMessages.length === 0) {
                return null; // No text, just show spinner
            }
            return loadingMessages[Math.min(loadingIndex, loadingMessages.length - 1)];
        }

        // For not-started state, only show message if explicitly provided
        return waitingMessage || null;
    }, [completeMessage, loadingIndex, loadingMessages, state, waitingMessage]);

    const iconWrapperClassName = cn(
        "flex size-8 items-center justify-center rounded-lg text-gray-500 transition-colors",
        state === "complete" && "bg-green-300 text-primary dark:bg-green-950",
        state === "in-progress" && "bg-primary/10 text-primary",
        state === "not-started" && "bg-gray-100 dark:bg-gray-950"
    );

    const handleActionClick = () => {
        if (isActionDisabled) {
            return;
        }
        if (onActionClick) {
            onActionClick();
        } else if (completeActionUrl) {
            window.open(completeActionUrl, "_blank", "noopener,noreferrer");
        }
    };

    const showSpinnerOnButton = state === "in-progress" && (completeActionLabel || inProgressActionLabel);
    const buttonLabel = state === "complete" ? completeActionLabel : inProgressActionLabel || completeActionLabel;

    return (
        <div
            className={cn(
                "border-border flex items-center justify-between rounded-xl gap-8 border p-5 min-w-[400px]",
                state === "in-progress" && "border-primary/40"
            )}
        >
            <div className="flex flex-col gap-2">
                <div className={iconWrapperClassName} aria-hidden>
                    {icon}
                </div>
                <p className="text-sm font-semibold">{title}</p>
            </div>
            {progressCopy && <div className="text-sm text-gray-500 dark:text-gray-300">{progressCopy}</div>}
            {buttonLabel && (
                <Button
                    variant="outline"
                    onClick={handleActionClick}
                    disabled={isActionDisabled}
                    className={cn(isActionDisabled && "opacity-50 cursor-not-allowed")}
                >
                    {showSpinnerOnButton && <Loader2Icon className="h-4 w-4 animate-spin mr-2" />}
                    {buttonLabel}
                </Button>
            )}
        </div>
    );
}
