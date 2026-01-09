"use client";

import { AlertCircle, ArrowLeft, Check, Loader2, RefreshCw, XCircle } from "lucide-react";
import { motion } from "motion/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { ThemedFernLogo } from "@/components/theme/ThemedFernLogo";

interface LogEntry {
    message: string;
    timestamp: string;
    type: "log" | "error" | "complete";
}

interface ProcessingStep {
    id: string;
    label: string;
    status: "pending" | "in_progress" | "completed" | "error";
}

const INITIAL_STEPS: ProcessingStep[] = [
    { id: "crawl", label: "Reading site", status: "pending" },
    { id: "classify", label: "Analyzing structure", status: "pending" },
    { id: "convert", label: "Reading content", status: "pending" },
    { id: "navigate", label: "Building navigation", status: "pending" },
    { id: "generate", label: "Writing project files", status: "pending" }
];

export default function ProcessingPage() {
    const router = useRouter();
    const [sourceUrl, setSourceUrl] = useState<string | null>(null);
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [steps, setSteps] = useState<ProcessingStep[]>(INITIAL_STEPS);
    const [status, setStatus] = useState<"connecting" | "processing" | "completed" | "error">("connecting");
    const [error, setError] = useState<string | null>(null);
    const logsEndRef = useRef<HTMLDivElement>(null);
    const eventSourceRef = useRef<EventSource | null>(null);

    // Scroll to bottom of logs
    useEffect(() => {
        logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, []);

    // Update step status based on log messages
    const updateStepFromLog = useCallback((message: string) => {
        const lowerMessage = message.toLowerCase();

        if (lowerMessage.includes("crawl")) {
            setSteps((prev) => prev.map((step) => (step.id === "crawl" ? { ...step, status: "in_progress" } : step)));
        }
        if (lowerMessage.includes("crawl complete") || lowerMessage.includes("pages found")) {
            setSteps((prev) =>
                prev.map((step) => {
                    if (step.id === "crawl") {
                        return { ...step, status: "completed" };
                    }
                    if (step.id === "classify") {
                        return { ...step, status: "in_progress" };
                    }
                    return step;
                })
            );
        }
        if (lowerMessage.includes("classif")) {
            setSteps((prev) =>
                prev.map((step) => (step.id === "classify" ? { ...step, status: "in_progress" } : step))
            );
        }
        if (lowerMessage.includes("classification complete")) {
            setSteps((prev) =>
                prev.map((step) => {
                    if (step.id === "classify") {
                        return { ...step, status: "completed" };
                    }
                    if (step.id === "convert") {
                        return { ...step, status: "in_progress" };
                    }
                    return step;
                })
            );
        }
        if (lowerMessage.includes("convert")) {
            setSteps((prev) => prev.map((step) => (step.id === "convert" ? { ...step, status: "in_progress" } : step)));
        }
        if (lowerMessage.includes("converted") && lowerMessage.includes("markdown")) {
            setSteps((prev) =>
                prev.map((step) => {
                    if (step.id === "convert") {
                        return { ...step, status: "completed" };
                    }
                    if (step.id === "navigate") {
                        return { ...step, status: "in_progress" };
                    }
                    return step;
                })
            );
        }
        if (lowerMessage.includes("navigation")) {
            setSteps((prev) =>
                prev.map((step) => (step.id === "navigate" ? { ...step, status: "in_progress" } : step))
            );
        }
        if (lowerMessage.includes("navigation tree built")) {
            setSteps((prev) =>
                prev.map((step) => {
                    if (step.id === "navigate") {
                        return { ...step, status: "completed" };
                    }
                    if (step.id === "generate") {
                        return { ...step, status: "in_progress" };
                    }
                    return step;
                })
            );
        }
        if (lowerMessage.includes("writing files") || lowerMessage.includes("wrote")) {
            setSteps((prev) =>
                prev.map((step) => (step.id === "generate" ? { ...step, status: "in_progress" } : step))
            );
        }
    }, []);

    // Connect to SSE and start processing
    useEffect(() => {
        // Get source URL from sessionStorage
        const stored = sessionStorage.getItem("siteToDocsInput");
        if (!stored) {
            router.push("/create-docs/import");
            return;
        }

        const { sourceUrl: url } = JSON.parse(stored);
        setSourceUrl(url);

        // Connect to SSE endpoint
        const params = new URLSearchParams({
            sourceUrl: url,
            sessionId: crypto.randomUUID()
        });

        const eventSource = new EventSource(`/api/site-to-docs/stream?${params.toString()}`);
        eventSourceRef.current = eventSource;

        eventSource.onopen = () => {
            setStatus("processing");
            setSteps((prev) => prev.map((step, idx) => (idx === 0 ? { ...step, status: "in_progress" } : step)));
        };

        eventSource.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                const { type, message, timestamp } = data;

                // Only add log messages to the display (not complete/error events with JSON data)
                if (type === "log") {
                    setLogs((prev) => [...prev, { message, timestamp, type }]);
                    updateStepFromLog(message);
                }

                if (type === "complete") {
                    setStatus("completed");
                    setSteps((prev) => prev.map((step) => ({ ...step, status: "completed" })));

                    // Parse completion data and store in sessionStorage
                    try {
                        const completionData = JSON.parse(message);
                        sessionStorage.setItem("siteToDocsOutput", JSON.stringify(completionData));
                    } catch (parseError) {
                        console.error("Failed to parse completion data:", parseError);
                    }
                } else if (type === "error") {
                    setStatus("error");
                    setError(message);
                    setSteps((prev) =>
                        prev.map((step) => (step.status === "in_progress" ? { ...step, status: "error" } : step))
                    );
                }
            } catch (parseError) {
                console.error("Failed to parse SSE message:", parseError);
            }
        };

        eventSource.onerror = () => {
            // Only show error if we haven't completed successfully
            // We check the eventSource readyState to see if it was intentionally closed
            if (eventSource.readyState !== EventSource.CLOSED) {
                setStatus((currentStatus) => {
                    if (currentStatus !== "completed") {
                        setError("Connection to server lost. Please try again.");
                        return "error";
                    }
                    return currentStatus;
                });
            }
            eventSource.close();
        };

        return () => {
            eventSource.close();
        };
    }, [router, updateStepFromLog]);

    const handleRetry = useCallback(() => {
        // Reset state and reconnect
        setLogs([]);
        setSteps(INITIAL_STEPS);
        setStatus("connecting");
        setError(null);

        // Close existing connection
        eventSourceRef.current?.close();

        // Trigger reconnect by refreshing the page
        window.location.reload();
    }, []);

    const handleCancel = useCallback(() => {
        eventSourceRef.current?.close();
        router.push("/create-docs/import");
    }, [router]);

    const handleContinue = useCallback(() => {
        router.push("/create-docs/setup?source=site-to-docs");
    }, [router]);

    return (
        <div className="relative flex min-h-screen w-full flex-col overflow-hidden">
            {/* Radial gradient background */}
            <div className="bg-gradient-radial pointer-events-none absolute inset-0 from-white via-gray-50 to-gray-100 dark:from-gray-900 dark:via-gray-950 dark:to-black" />

            {/* Header */}
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.3 }}
                className="relative z-10 w-full p-4"
            >
                <div className="flex items-center justify-between">
                    <Link href="/">
                        <ThemedFernLogo className="w-16" />
                    </Link>
                    {status !== "processing" && (
                        <Link
                            href="/create-docs/import"
                            className="flex items-center gap-2 text-sm text-text-description transition-colors hover:text-gray-1200"
                        >
                            <ArrowLeft className="h-4 w-4" />
                            Back
                        </Link>
                    )}
                </div>
            </motion.div>

            {/* Main content */}
            <div className="relative z-10 flex flex-1 flex-col items-center px-4 py-8">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: 0.1 }}
                    className="w-full max-w-3xl"
                >
                    {/* Title */}
                    <h1 className="mb-2 text-center text-2xl font-semibold text-gray-900 dark:text-white">
                        {status === "completed"
                            ? "Import complete!"
                            : status === "error"
                              ? "Import failed"
                              : "Importing your documentation"}
                    </h1>
                    {sourceUrl && (
                        <p className="mb-8 text-center text-text-description">
                            {status === "completed"
                                ? "Your documentation has been converted to a Fern project"
                                : status === "error"
                                  ? "There was a problem importing your documentation"
                                  : `Processing ${sourceUrl}`}
                        </p>
                    )}

                    {/* Progress steps */}
                    <div className="mb-8 rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
                        <div className="space-y-4">
                            {steps.map((step, index) => (
                                <div key={step.id} className="flex items-center gap-3">
                                    {/* Status icon */}
                                    <div
                                        className={`flex h-8 w-8 items-center justify-center rounded-full ${
                                            step.status === "completed"
                                                ? "bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400"
                                                : step.status === "in_progress"
                                                  ? "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"
                                                  : step.status === "error"
                                                    ? "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400"
                                                    : "bg-gray-100 text-gray-400 dark:bg-gray-700 dark:text-gray-500"
                                        }`}
                                    >
                                        {step.status === "completed" ? (
                                            <Check className="h-4 w-4" />
                                        ) : step.status === "in_progress" ? (
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                        ) : step.status === "error" ? (
                                            <XCircle className="h-4 w-4" />
                                        ) : (
                                            <span className="text-sm font-medium">{index + 1}</span>
                                        )}
                                    </div>

                                    {/* Step label */}
                                    <span
                                        className={`font-medium ${
                                            step.status === "completed"
                                                ? "text-green-600 dark:text-green-400"
                                                : step.status === "in_progress"
                                                  ? "text-blue-600 dark:text-blue-400"
                                                  : step.status === "error"
                                                    ? "text-red-600 dark:text-red-400"
                                                    : "text-gray-400 dark:text-gray-500"
                                        }`}
                                    >
                                        {step.label}
                                        {step.status === "in_progress" && "..."}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Logs panel */}
                    <div className="mb-6 rounded-xl border border-gray-200 bg-gray-900 dark:border-gray-700">
                        <div className="flex items-center justify-between border-b border-gray-700 px-4 py-2">
                            <span className="text-sm font-medium text-gray-400">Output</span>
                            <div className="flex items-center gap-2">
                                {status === "processing" && (
                                    <span className="flex items-center gap-1.5 text-xs text-green-400">
                                        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-green-400" />
                                        Live
                                    </span>
                                )}
                            </div>
                        </div>
                        <div className="h-64 overflow-y-auto p-4 font-mono text-sm">
                            {logs.length === 0 ? (
                                <span className="text-gray-500">Connecting to server...</span>
                            ) : (
                                logs.map((log, index) => (
                                    <div
                                        key={index}
                                        className={`mb-1 ${
                                            log.type === "error"
                                                ? "text-red-400"
                                                : log.type === "complete"
                                                  ? "text-green-400"
                                                  : "text-gray-300"
                                        }`}
                                    >
                                        {log.message}
                                    </div>
                                ))
                            )}
                            <div ref={logsEndRef} />
                        </div>
                    </div>

                    {/* Error message */}
                    {error && (
                        <motion.div
                            initial={{ opacity: 0, y: -4 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="mb-6 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-4 text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400"
                        >
                            <AlertCircle className="h-5 w-5 flex-shrink-0" />
                            <span>{error}</span>
                        </motion.div>
                    )}

                    {/* Action buttons */}
                    <div className="flex justify-center gap-4">
                        {status === "error" && (
                            <>
                                <button
                                    onClick={handleCancel}
                                    className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-6 py-3 font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleRetry}
                                    className="flex items-center gap-2 rounded-lg bg-green-500 px-6 py-3 font-medium text-white transition-colors hover:bg-green-600"
                                >
                                    <RefreshCw className="h-4 w-4" />
                                    Try again
                                </button>
                            </>
                        )}
                        {status === "processing" && (
                            <button
                                onClick={handleCancel}
                                className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-6 py-3 font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
                            >
                                Cancel
                            </button>
                        )}
                        {status === "completed" && (
                            <button
                                onClick={handleContinue}
                                className="flex items-center gap-2 rounded-lg bg-green-500 px-6 py-3 font-medium text-white transition-colors hover:bg-green-600"
                            >
                                Continue
                                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M9 5l7 7-7 7"
                                    />
                                </svg>
                            </button>
                        )}
                    </div>
                </motion.div>
            </div>
        </div>
    );
}
