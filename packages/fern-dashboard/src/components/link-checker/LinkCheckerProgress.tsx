"use client";

import { Loader2Icon } from "lucide-react";
import { useEffect, useRef } from "react";

import type { LinkCheckerStatus, LogEntry } from "./useLinkChecker";

interface LinkCheckerProgressProps {
    status: LinkCheckerStatus;
    totalPages: number;
    pagesScraped: number;
    totalLinks: number;
    linksChecked: number;
    logs: LogEntry[];
}

function getStatusText(
    status: LinkCheckerStatus,
    pagesScraped: number,
    totalPages: number,
    linksChecked: number,
    totalLinks: number
): string {
    switch (status) {
        case "fetching_sitemap":
            return "Fetching sitemap...";
        case "scraping_pages":
            return `Scraping pages (${pagesScraped}/${totalPages})...`;
        case "checking_links":
            return `Checking links (${linksChecked}/${totalLinks})...`;
        case "complete":
            return "Complete!";
        case "error":
            return "Error occurred";
        default:
            return "Ready to start";
    }
}

function getLogTypeColor(type: LogEntry["type"]): string {
    switch (type) {
        case "success":
            return "text-green-600 dark:text-green-400";
        case "warning":
            return "text-yellow-600 dark:text-yellow-400";
        case "error":
            return "text-red-600 dark:text-red-400";
        default:
            return "text-foreground/70";
    }
}

export default function LinkCheckerProgress({
    status,
    totalPages,
    pagesScraped,
    totalLinks,
    linksChecked,
    logs
}: LinkCheckerProgressProps) {
    const logsEndRef = useRef<HTMLDivElement>(null);

    // biome-ignore lint/correctness/useExhaustiveDependencies: intentionally trigger scroll when logs change
    useEffect(() => {
        logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [logs.length]);

    const isRunning = status !== "idle" && status !== "complete" && status !== "error";
    const isScraping = status === "scraping_pages" || status === "fetching_sitemap";
    const isCheckingLinks = status === "checking_links";

    const scrapeProgress = totalPages > 0 ? Math.round((pagesScraped / totalPages) * 100) : 0;
    const linkCheckProgress = totalLinks > 0 ? Math.round((linksChecked / totalLinks) * 100) : 0;

    return (
        <div className="space-y-4">
            <div className="flex items-center gap-3">
                {isRunning && <Loader2Icon className="h-5 w-5 animate-spin text-foreground/50" />}
                <span className="text-sm font-medium">
                    {getStatusText(status, pagesScraped, totalPages, linksChecked, totalLinks)}
                </span>
            </div>

            {/* Page scraping progress */}
            {(isScraping || isCheckingLinks) && totalPages > 0 && (
                <div className="space-y-2">
                    <div className="flex justify-between text-xs text-foreground/70">
                        <span>Pages scraped</span>
                        <span>
                            {pagesScraped}/{totalPages}
                        </span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
                        <div
                            className={`h-full transition-all duration-300 ${isCheckingLinks ? "bg-green-500" : "bg-foreground/30"}`}
                            style={{ width: `${scrapeProgress}%` }}
                        />
                    </div>
                </div>
            )}

            {/* Link checking progress */}
            {isCheckingLinks && totalLinks > 0 && (
                <div className="space-y-2">
                    <div className="flex justify-between text-xs text-foreground/70">
                        <span>Links checked</span>
                        <span>
                            {linksChecked}/{totalLinks}
                        </span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
                        <div
                            className="h-full bg-foreground/30 transition-all duration-300"
                            style={{ width: `${linkCheckProgress}%` }}
                        />
                    </div>
                </div>
            )}

            {logs.length > 0 && (
                <div className="max-h-64 overflow-y-auto rounded-lg border border-gray-200 bg-gray-50 p-3 font-mono text-xs dark:border-gray-700 dark:bg-gray-900">
                    {logs.map((log, index) => (
                        <div key={index} className="flex gap-3 py-0.5">
                            <span className="text-foreground/50">
                                {new Date(log.timestamp).toLocaleTimeString("en-US", {
                                    hour12: false,
                                    hour: "2-digit",
                                    minute: "2-digit",
                                    second: "2-digit"
                                })}
                            </span>
                            <span className={getLogTypeColor(log.type)}>{log.message}</span>
                        </div>
                    ))}
                    <div ref={logsEndRef} />
                </div>
            )}
        </div>
    );
}
