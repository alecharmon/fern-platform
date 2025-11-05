"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { toast } from "sonner";

import { getToggleStatus, isAskAiEnabled, reindexAskAi, toggleAskAi } from "@/app/actions/toggleAskAi";
import type { DocsUrl } from "@/utils/types";
import { useOrgNameFromPathname } from "@/utils/useOrgNameFromPathname";

import { Button } from "../ui/button";

export declare namespace ToggleAskAiButton {
    export interface Props {
        docsUrl: DocsUrl;
        initialAskAiStatus: { ask_ai_enabled: boolean; job_id?: string } | null;
    }
}

export function ToggleAskAiButton({ docsUrl, initialAskAiStatus }: ToggleAskAiButton.Props) {
    const [isEnabled, setIsEnabled] = useState<boolean | null>(initialAskAiStatus?.ask_ai_enabled ?? null);
    const [isToggling, setIsToggling] = useState(false);
    const [isReindexing, setIsReindexing] = useState(Boolean(initialAskAiStatus?.job_id));
    const [dotCount, setDotCount] = useState(0);

    const orgName = useOrgNameFromPathname();
    const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

    const fetchSettings = useCallback(async () => {
        try {
            const response = await isAskAiEnabled({ domain: docsUrl });
            setIsEnabled(response.ask_ai_enabled);

            if (response.job_id) {
                setIsReindexing(true);
                return response.job_id;
            }
        } catch (error) {
            console.error("Failed to fetch settings:", error);
        }
        return null;
    }, [docsUrl]);

    const pollJobStatus = useCallback(async () => {
        try {
            const status = await getToggleStatus({ domain: docsUrl });

            if (status === "completed") {
                setIsReindexing(false);
                toast.success("Ask AI enabled successfully! Documentation has been reindexed.");

                if (pollIntervalRef.current) {
                    clearInterval(pollIntervalRef.current);
                    pollIntervalRef.current = null;
                }

                await fetchSettings();
            } else if (status === "failed") {
                setIsReindexing(false);
                toast.error("Failed to reindex documentation. Ask AI may not work properly.");

                if (pollIntervalRef.current) {
                    clearInterval(pollIntervalRef.current);
                    pollIntervalRef.current = null;
                }
            }
        } catch (error) {
            console.error("Failed to check reindex status:", error);
            setIsReindexing(false);

            if (pollIntervalRef.current) {
                clearInterval(pollIntervalRef.current);
                pollIntervalRef.current = null;
            }
        }
    }, [docsUrl, fetchSettings]);

    const startPolling = useCallback(() => {
        if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
        }

        pollIntervalRef.current = setInterval(() => {
            void pollJobStatus();
        }, 7000);
    }, [pollJobStatus]);

    useEffect(() => {
        const initializeSettings = async () => {
            if (initialAskAiStatus?.job_id) {
                startPolling();
            } else {
                const jobId = await fetchSettings();
                if (jobId) {
                    startPolling();
                }
            }
        };

        void initializeSettings();

        return () => {
            if (pollIntervalRef.current) {
                clearInterval(pollIntervalRef.current);
            }
        };
    }, [fetchSettings, startPolling, initialAskAiStatus?.job_id]);

    useEffect(() => {
        let dotInterval: NodeJS.Timeout;
        if (isReindexing) {
            dotInterval = setInterval(() => {
                setDotCount((prev) => (prev + 1) % 4);
            }, 500);
        }
        return () => {
            if (dotInterval) {
                clearInterval(dotInterval);
            }
        };
    }, [isReindexing]);

    const handleAskAiOperation = async (operation: "toggle" | "reindex") => {
        setIsToggling(true);
        try {
            const response =
                operation === "toggle"
                    ? await toggleAskAi({ domain: docsUrl, orgName })
                    : await reindexAskAi({ domain: docsUrl, orgName });

            if (response.success) {
                setIsEnabled(response.ask_ai_enabled);

                if (response.job_id) {
                    setIsReindexing(true);
                    if (operation === "toggle") {
                        toast.info("Ask AI enabled. Reindexing documentation in background...", {
                            duration: 4000
                        });
                    } else {
                        toast.info("Reindexing documentation in background...", {
                            duration: 4000
                        });
                    }
                    startPolling();
                } else if (operation === "toggle" && !response.ask_ai_enabled) {
                    toast.success("Ask AI disabled");
                    setIsReindexing(false);

                    if (pollIntervalRef.current) {
                        clearInterval(pollIntervalRef.current);
                        pollIntervalRef.current = null;
                    }
                }
            } else {
                const operationText = operation === "toggle" ? "toggle Ask AI" : "reindex documentation";
                toast.error(`Failed to ${operationText}`);
            }
        } catch (e) {
            const operationText = operation === "toggle" ? "toggle Ask AI" : "reindex documentation";
            console.error(`Failed to ${operationText} for ${docsUrl}`, e);
            toast.error(`Failed to ${operationText}`);
        }
        setIsToggling(false);
    };

    const toggle = () => handleAskAiOperation("toggle");
    const reindex = () => handleAskAiOperation("reindex");

    const getReindexingText = () => {
        const dots = ".".repeat(dotCount);
        return `Reindexing${dots}`;
    };

    const getButtonText = () => {
        if (isEnabled == null) return "Loading...";
        return isEnabled ? "Disable" : "Enable";
    };

    return (
        <div className="flex items-center justify-end gap-2">
            {isReindexing && <p className="mr-1 w-24 text-sm whitespace-nowrap">{getReindexingText()}</p>}
            {isEnabled && !isReindexing && (
                <Button
                    variant="outline"
                    onClick={() => {
                        void reindex();
                    }}
                    disabled={isEnabled == null || isToggling}
                    className="w-20"
                >
                    Reindex
                </Button>
            )}
            <Button
                variant={isEnabled ? "destructive" : "default"}
                onClick={() => {
                    void toggle();
                }}
                loading={!isEnabled && isToggling}
                disabled={isEnabled == null || isToggling || isReindexing}
                className="w-24"
            >
                {getButtonText()}
            </Button>
        </div>
    );
}
