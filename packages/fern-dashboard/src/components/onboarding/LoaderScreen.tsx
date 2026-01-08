"use client";

import { Loader2Icon } from "lucide-react";
import { motion } from "motion/react";
import { useEffect, useRef, useState } from "react";

import type { WizardFormData } from "@/providers/OnboardingProvider";

interface LoaderScreenProps {
    wizardFormData: WizardFormData;
    orgName?: string;
    loadingMessage?: string;
    showLogs?: boolean;
    sessionId?: string;
    onComplete?: (result: { url: string; fernDocsDownloadUrl?: string; githubRepoUrl?: string }) => void;
}

interface LogEntry {
    type: string;
    message: string;
    timestamp: string;
}

export function LoaderScreen({
    wizardFormData,
    orgName,
    loadingMessage = "Reading your docs.yml...",
    showLogs = false,
    sessionId,
    onComplete
}: LoaderScreenProps) {
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [isComplete, setIsComplete] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const logsEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!showLogs || !sessionId || !orgName) {
            return;
        }

        // Encode the wizard data to pass to the stream endpoint
        const dataParam = encodeURIComponent(JSON.stringify({ ...wizardFormData, orgName }));
        const eventSource = new EventSource(`/api/onboarding-docs/stream?sessionId=${sessionId}&data=${dataParam}`);

        eventSource.onmessage = (event) => {
            try {
                const data: LogEntry = JSON.parse(event.data);

                if (data.type === "complete") {
                    setIsComplete(true);
                    eventSource.close();
                    if (onComplete) {
                        // Parse the completion message which contains the result data
                        const result = JSON.parse(data.message);
                        onComplete(result);
                    }
                } else if (data.type === "error") {
                    setError(data.message);
                    eventSource.close();
                } else if (data.type === "log") {
                    setLogs((prev) => [...prev, data]);
                }
            } catch (err) {
                console.error("Failed to parse SSE message:", err);
            }
        };

        eventSource.onerror = (err) => {
            console.error("SSE error:", err);
            setError("Connection lost to server");
            eventSource.close();
        };

        return () => {
            eventSource.close();
        };
    }, [showLogs, sessionId, onComplete, orgName, wizardFormData]);

    // Auto-scroll to bottom when new logs arrive
    // biome-ignore lint/correctness/useExhaustiveDependencies: We want to scroll on every log change
    useEffect(() => {
        logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [logs]);

    return (
        <div className="flex w-full flex-col items-center justify-center gap-8">
            {/* Title */}
            <h1 className="text-3xl font-semibold text-gray-900 dark:text-white">Publishing your docs site!</h1>

            {/* Logs container - always visible */}
            {showLogs && (
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3 }}
                    className="border-border max-h-[600px] min-h-[600px] w-full max-w-3xl overflow-hidden overflow-y-scroll rounded-lg border bg-white dark:border-gray-700 dark:bg-black"
                >
                    <div className="min-h-full overflow-y-auto p-4 font-mono text-xs">
                        {logs.length === 0 ? (
                            <div className="flex items-center gap-2 text-gray-900 dark:text-white">
                                <Loader2Icon className="h-4 w-4 animate-spin" />
                                <span>Connecting...</span>
                            </div>
                        ) : (
                            logs.map((log, index) => (
                                <div key={index} className="flex gap-3 py-1 text-gray-900 dark:text-white">
                                    <span className="text-gray-900 dark:text-white">
                                        {new Date(log.timestamp).toLocaleTimeString("en-US", {
                                            hour12: false,
                                            hour: "2-digit",
                                            minute: "2-digit",
                                            second: "2-digit"
                                        })}
                                    </span>
                                    <span className="flex-1">{log.message}</span>
                                </div>
                            ))
                        )}
                        <div ref={logsEndRef} />
                    </div>
                </motion.div>
            )}

            {/* Error display */}
            {error && (
                <div className="border-border w-full max-w-3xl rounded-lg border bg-white p-4 text-sm text-red-800 dark:border-red-800 dark:bg-black dark:text-red-400">
                    {error}
                </div>
            )}

            {/* Completion message */}
            {isComplete && (
                <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                    <svg
                        className="h-5 w-5"
                        fill="none"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                    >
                        <path d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="text-sm font-medium">Documentation published successfully!</span>
                </div>
            )}
        </div>
    );
}
