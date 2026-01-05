"use client";

import { useCallback, useRef, useState } from "react";

import type {
    BatchCompleteData,
    BrokenLink,
    CompleteData,
    ErrorData,
    LinkCheckedData,
    LinkCheckProgress,
    LinkProgressUpdateData,
    LinksCheckStartedData,
    PageScrapedData,
    ScrapeCompleteData,
    SitemapFetchedData
} from "@/app/api/link-checker/types";

export type LinkCheckerStatus =
    | "idle"
    | "fetching_sitemap"
    | "scraping_pages"
    | "checking_links"
    | "complete"
    | "error";

export interface LogEntry {
    message: string;
    timestamp: string;
    type: "info" | "success" | "warning" | "error";
}

export interface LinkCheckerState {
    status: LinkCheckerStatus;
    totalPages: number;
    pagesScraped: number;
    totalLinks: number;
    linksChecked: number;
    brokenLinks: BrokenLink[];
    blockedLinks: BrokenLink[];
    workingLinks: number;
    skippedLinks: number;
    duration: number;
    logs: LogEntry[];
    error: string | null;
}

const initialState: LinkCheckerState = {
    status: "idle",
    totalPages: 0,
    pagesScraped: 0,
    totalLinks: 0,
    linksChecked: 0,
    brokenLinks: [],
    blockedLinks: [],
    workingLinks: 0,
    skippedLinks: 0,
    duration: 0,
    logs: [],
    error: null
};

export function useLinkChecker() {
    const [state, setState] = useState<LinkCheckerState>(initialState);
    const eventSourceRef = useRef<EventSource | null>(null);
    const domainRef = useRef<string>("");

    const addLog = useCallback((message: string, type: LogEntry["type"]) => {
        setState((prev) => ({
            ...prev,
            logs: [...prev.logs, { message, timestamp: new Date().toISOString(), type }]
        }));
    }, []);

    const startCheckPhase = useCallback(
        (domain: string, jobId: string) => {
            if (eventSourceRef.current) {
                eventSourceRef.current.close();
            }

            const eventSource = new EventSource(
                `/api/link-checker?domain=${encodeURIComponent(domain)}&phase=check&jobId=${encodeURIComponent(jobId)}`
            );
            eventSourceRef.current = eventSource;

            eventSource.onmessage = (event) => {
                try {
                    const progress: LinkCheckProgress = JSON.parse(event.data);

                    switch (progress.type) {
                        case "links_check_started": {
                            const data = progress.data as LinksCheckStartedData;
                            setState((prev) => ({
                                ...prev,
                                status: "checking_links",
                                totalLinks: data.totalLinks,
                                linksChecked: 0
                            }));
                            addLog(`Checking ${data.totalLinks} unique links...`, "info");
                            break;
                        }
                        case "link_check_progress": {
                            const data = progress.data as LinkProgressUpdateData;
                            setState((prev) => ({
                                ...prev,
                                linksChecked: data.linksChecked
                            }));
                            break;
                        }
                        case "link_checked": {
                            const data = progress.data as LinkCheckedData;
                            setState((prev) => ({
                                ...prev,
                                brokenLinks: [
                                    ...prev.brokenLinks,
                                    {
                                        url: data.url,
                                        statusCode: data.statusCode,
                                        error: data.error,
                                        sourcePages: data.sourcePages,
                                        isInternal: data.isInternal
                                    }
                                ]
                            }));
                            addLog(`Broken link: ${data.url} (${data.statusCode})`, "error");
                            break;
                        }
                        case "link_blocked": {
                            const data = progress.data as LinkCheckedData;
                            setState((prev) => ({
                                ...prev,
                                blockedLinks: [
                                    ...prev.blockedLinks,
                                    {
                                        url: data.url,
                                        statusCode: data.statusCode,
                                        error: data.error,
                                        sourcePages: data.sourcePages,
                                        isInternal: data.isInternal
                                    }
                                ]
                            }));
                            addLog(`Blocked link: ${data.url} (403)`, "warning");
                            break;
                        }
                        case "batch_complete": {
                            const data = progress.data as BatchCompleteData;
                            if (data.hasMore) {
                                addLog(`Batch complete, continuing with next batch...`, "info");
                                eventSource.close();
                                startCheckPhase(domain, data.jobId);
                            }
                            break;
                        }
                        case "complete": {
                            const data = progress.data as CompleteData;
                            setState((prev) => {
                                const totalBroken = prev.brokenLinks.length;
                                const totalBlocked = prev.blockedLinks.length;
                                const blockedMsg =
                                    totalBlocked > 0 ? ` (${totalBlocked} blocked by bot detection)` : "";
                                addLog(
                                    `Complete! Found ${totalBroken} broken links out of ${data.totalLinks} total links${blockedMsg}`,
                                    "success"
                                );
                                return {
                                    ...prev,
                                    status: "complete",
                                    totalPages: data.totalPages,
                                    totalLinks: data.totalLinks,
                                    workingLinks: data.workingLinks,
                                    skippedLinks: data.skippedLinks,
                                    duration: data.duration
                                };
                            });
                            eventSource.close();
                            break;
                        }
                        case "error": {
                            const data = progress.data as ErrorData;
                            setState((prev) => ({
                                ...prev,
                                status: "error",
                                error: data.message
                            }));
                            addLog(`Error: ${data.message}`, "error");
                            eventSource.close();
                            break;
                        }
                    }
                } catch (err) {
                    console.error("Failed to parse SSE message:", err);
                }
            };

            eventSource.onerror = () => {
                setState((prev) => ({
                    ...prev,
                    status: "error",
                    error: "Connection lost to server"
                }));
                addLog("Connection lost to server", "error");
                eventSource.close();
            };
        },
        [addLog]
    );

    const start = useCallback(
        (domain: string) => {
            if (eventSourceRef.current) {
                eventSourceRef.current.close();
            }

            domainRef.current = domain;

            setState({
                ...initialState,
                status: "fetching_sitemap",
                logs: [
                    {
                        message: `Starting link check for ${domain}...`,
                        timestamp: new Date().toISOString(),
                        type: "info"
                    }
                ]
            });

            const eventSource = new EventSource(`/api/link-checker?domain=${encodeURIComponent(domain)}&phase=scrape`);
            eventSourceRef.current = eventSource;

            eventSource.onmessage = (event) => {
                try {
                    const progress: LinkCheckProgress = JSON.parse(event.data);

                    switch (progress.type) {
                        case "sitemap_fetched": {
                            const data = progress.data as SitemapFetchedData;
                            setState((prev) => ({
                                ...prev,
                                status: "scraping_pages",
                                totalPages: data.totalPages
                            }));
                            addLog(`Found ${data.totalPages} pages in sitemap`, "success");
                            break;
                        }
                        case "page_scraped": {
                            const data = progress.data as PageScrapedData;
                            setState((prev) => ({
                                ...prev,
                                pagesScraped: data.pageIndex,
                                totalLinks: prev.totalLinks + data.linksFound
                            }));
                            break;
                        }
                        case "scrape_complete": {
                            const data = progress.data as ScrapeCompleteData;
                            setState((prev) => ({
                                ...prev,
                                totalLinks: data.totalLinks
                            }));
                            addLog(`Scraping complete. Found ${data.totalLinks} unique links.`, "success");
                            eventSource.close();
                            startCheckPhase(domain, data.jobId);
                            break;
                        }
                        case "error": {
                            const data = progress.data as ErrorData;
                            setState((prev) => ({
                                ...prev,
                                status: "error",
                                error: data.message
                            }));
                            addLog(`Error: ${data.message}`, "error");
                            eventSource.close();
                            break;
                        }
                    }
                } catch (err) {
                    console.error("Failed to parse SSE message:", err);
                }
            };

            eventSource.onerror = () => {
                setState((prev) => ({
                    ...prev,
                    status: "error",
                    error: "Connection lost to server"
                }));
                addLog("Connection lost to server", "error");
                eventSource.close();
            };
        },
        [addLog, startCheckPhase]
    );

    const stop = useCallback(() => {
        if (eventSourceRef.current) {
            eventSourceRef.current.close();
            eventSourceRef.current = null;
        }
        setState((prev) => ({
            ...prev,
            status: "idle"
        }));
        addLog("Link check stopped", "info");
    }, [addLog]);

    const reset = useCallback(() => {
        if (eventSourceRef.current) {
            eventSourceRef.current.close();
            eventSourceRef.current = null;
        }
        setState(initialState);
    }, []);

    return {
        ...state,
        start,
        stop,
        reset,
        isRunning: state.status !== "idle" && state.status !== "complete" && state.status !== "error"
    };
}
