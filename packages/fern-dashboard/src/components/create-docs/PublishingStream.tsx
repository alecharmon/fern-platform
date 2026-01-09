"use client";

import { ExternalLink, Loader2 } from "lucide-react";
import { motion } from "motion/react";
import { useEffect, useRef, useState } from "react";

interface PublishingStreamProps {
    repoName: string;
    siteUrl: string;
    repoUrl: string;
    onComplete: (result: { url: string; githubRepoUrl: string }) => void;
    onError: (actionsUrl: string) => void;
}

interface LogEntry {
    type: "log" | "error" | "complete";
    message: string;
    timestamp: string;
}

export function PublishingStream({ repoName, siteUrl, repoUrl, onComplete, onError }: PublishingStreamProps) {
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [isConnecting, setIsConnecting] = useState(true);
    const logsEndRef = useRef<HTMLDivElement>(null);
    const hasConnectedRef = useRef(false);
    const onCompleteRef = useRef(onComplete);
    const onErrorRef = useRef(onError);

    // Keep refs in sync
    useEffect(() => {
        onCompleteRef.current = onComplete;
    }, [onComplete]);

    useEffect(() => {
        onErrorRef.current = onError;
    }, [onError]);

    useEffect(() => {
        if (hasConnectedRef.current) {
            return;
        }
        hasConnectedRef.current = true;

        const eventSource = new EventSource(
            `/api/create-docs-publish/stream?repoName=${encodeURIComponent(repoName)}&siteUrl=${encodeURIComponent(siteUrl)}`
        );

        eventSource.onopen = () => {
            setIsConnecting(false);
        };

        eventSource.onmessage = (event) => {
            try {
                const data: LogEntry = JSON.parse(event.data);

                if (data.type === "complete") {
                    eventSource.close();
                    const result = JSON.parse(data.message);
                    if (result.success) {
                        onCompleteRef.current(result);
                    } else {
                        onErrorRef.current(`${repoUrl}/actions`);
                    }
                } else if (data.type === "error") {
                    setLogs((prev) => [...prev, data]);
                    eventSource.close();
                    onErrorRef.current(`${repoUrl}/actions`);
                } else if (data.type === "log") {
                    setLogs((prev) => [...prev, data]);
                }
            } catch (err) {
                console.error("Failed to parse SSE message:", err);
            }
        };

        eventSource.onerror = () => {
            setIsConnecting(false);
            eventSource.close();
            onErrorRef.current(`${repoUrl}/actions`);
        };

        return () => {
            eventSource.close();
            hasConnectedRef.current = false;
        };
    }, [repoName, siteUrl, repoUrl]);

    // Auto-scroll to bottom when new logs arrive
    // biome-ignore lint/correctness/useExhaustiveDependencies: We want to scroll on every log change
    useEffect(() => {
        logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [logs]);

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="flex h-full flex-col"
        >
            <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Publishing Docs</h2>
                <a
                    href={`${repoUrl}/actions`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
                >
                    View on GitHub
                    <ExternalLink className="h-3 w-3" />
                </a>
            </div>

            <div className="flex-1 overflow-hidden rounded-lg border border-gray-200 bg-gray-900 dark:border-gray-700">
                <div className="h-full overflow-y-auto p-4 font-mono text-xs">
                    {isConnecting && logs.length === 0 ? (
                        <div className="flex items-center gap-2 text-gray-400">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            <span>Connecting...</span>
                        </div>
                    ) : (
                        logs.map((log, index) => (
                            <div
                                key={index}
                                className={`flex gap-3 py-1 ${log.type === "error" ? "text-red-400" : "text-gray-300"}`}
                            >
                                <span className="flex-shrink-0 text-gray-500">
                                    {new Date(log.timestamp).toLocaleTimeString("en-US", {
                                        hour12: false,
                                        hour: "2-digit",
                                        minute: "2-digit",
                                        second: "2-digit"
                                    })}
                                </span>
                                <span className="flex-1 whitespace-pre-wrap">{log.message}</span>
                            </div>
                        ))
                    )}
                    <div ref={logsEndRef} />
                </div>
            </div>
        </motion.div>
    );
}
