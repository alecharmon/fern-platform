"use client";

import type { FernAI } from "@fern-api/fai-sdk";
import React, { useEffect, useState } from "react";

import { getDomainAnalytics } from "@/app/actions/getAnalytics";
import { getConversationResolution } from "@/app/actions/getConversationResolution";
import { getQueries } from "@/app/actions/getQueries";
import { useSidepanel } from "@/components/layout/SidepanelContext";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/utils/utils";

import { AnalyticsHistogramSkeleton } from "./AnalyticsHistogramSkeleton";
import { ITEMS_PER_PAGE } from "./AnalyticsPage";
import { AnalyticsPageHeader } from "./AnalyticsPageHeader";
import { ConversationSidePanel } from "./ConversationSidePanel";
import { ConversationsCard } from "./ConversationsCard";
import { TimeRange } from "./utils/get-request-params";

export type RenderType = "QUERIES" | "CONVERSATIONS";

const ANALYTICS_PAGE_STYLES = "flex min-w-0 flex-1 flex-col items-center transition-[flex] duration-500 ease-out";
export const BORDER_STYLES = "mb-4 flex w-full flex-col items-center rounded-2xl p-4";

export function AnalyticsPageClient({
    baseDocsUrl,
    initialQueriesData,
    initialHistogramData,
    initialResolutionData,
    initialTotalQueries,
    cutoffTime,
    analyticsBillingEnabled
}: {
    baseDocsUrl: string;
    initialQueriesData: FernAI.Query[];
    initialHistogramData: FernAI.GetHistogramAnalyticsResponse;
    initialResolutionData: FernAI.GetConversationResolutionResponse;
    initialTotalQueries: number;
    cutoffTime: string;
    analyticsBillingEnabled: boolean;
}) {
    const [timeRange, setTimeRange] = useState<TimeRange>(TimeRange.LAST_WEEK);
    const [histogramData, setHistogramData] = useState(initialHistogramData);
    const [resolutionData, setResolutionData] = useState(initialResolutionData);
    const [queriesData, setQueriesData] = useState(initialQueriesData);
    const [totalQueriesPages, setTotalQueriesPages] = useState(Math.ceil(initialTotalQueries / ITEMS_PER_PAGE));
    const [selectedConversation, setSelectedConversation] = useState<FernAI.Conversation | null>(null);
    const [isConversationLoading, setIsConversationLoading] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const [isLoading, setIsLoading] = useState(false);
    const [pageCache, setPageCache] = useState<Record<number, FernAI.Query[]>>({});
    const [selectedBarIndex, setSelectedBarIndex] = useState<number | null>(null);
    const { setContent, clear } = useSidepanel();

    useEffect(() => {
        async function fetchData() {
            try {
                const [histogram, resolution] = await Promise.all([
                    getDomainAnalytics({
                        docsUrl: baseDocsUrl,
                        timeRange
                    }),
                    getConversationResolution({
                        docsUrl: baseDocsUrl,
                        timeRange
                    })
                ]);
                setHistogramData(histogram);
                setResolutionData(resolution);
            } catch (error) {
                console.error("Failed to fetch analytics data:", error);
            }
        }

        void fetchData();
    }, [baseDocsUrl, timeRange]);

    useEffect(() => {
        async function fetchQueriesData() {
            const cachedData = pageCache[currentPage];
            if (cachedData) {
                setQueriesData(cachedData);
                return;
            }

            setIsLoading(true);
            try {
                const response = await getQueries({
                    domain: baseDocsUrl,
                    page: currentPage,
                    limit: ITEMS_PER_PAGE,
                    cutoffTime,
                    timeRange
                });

                setPageCache((prev) => ({
                    ...prev,
                    [currentPage]: response.queries
                }));

                setQueriesData(response.queries);
                setTotalQueriesPages(Math.ceil(response.pagination.total / ITEMS_PER_PAGE));
            } catch (error) {
                console.error("Failed to fetch queries data:", error);
            } finally {
                setIsLoading(false);
            }
        }

        void fetchQueriesData();
    }, [baseDocsUrl, currentPage, timeRange, cutoffTime, pageCache]);

    useEffect(() => {
        setPageCache({});
        setCurrentPage(1);
    }, [timeRange, cutoffTime]);

    const timeoutRef = React.useRef<number | null>(null);

    function handleBarClick(barIndex: number) {
        setSelectedBarIndex(barIndex === selectedBarIndex ? null : barIndex);
        setCurrentPage(1);
        setPageCache({});
    }

    function handleSelectConversation(convo: FernAI.Conversation | null) {
        if (convo) {
            setSelectedConversation(convo);
            setIsConversationLoading(true);
            // Allow panel to slide in or fetch any extra data; then stop loading
            if (timeoutRef.current != null) {
                window.clearTimeout(timeoutRef.current);
            }
            timeoutRef.current = window.setTimeout(() => {
                setIsConversationLoading(false);
                timeoutRef.current = null;
            }, 300);
        } else {
            setSelectedConversation(null);
            setIsConversationLoading(false);
            clear();
        }
    }

    useEffect(() => {
        return () => {
            if (timeoutRef.current != null) {
                window.clearTimeout(timeoutRef.current);
                timeoutRef.current = null;
            }
        };
    }, []);

    useEffect(() => {
        if (selectedConversation) {
            setContent(
                <ConversationSidePanel
                    conversation={selectedConversation}
                    isConversationLoading={isConversationLoading}
                    onClose={() => {
                        clear();
                        setSelectedConversation(null);
                        setIsConversationLoading(false);
                    }}
                />
            );
        }
        // Intentionally omit setContent/clear to avoid unstable ref loops
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedConversation, isConversationLoading]);

    return (
        <div className={ANALYTICS_PAGE_STYLES}>
            <AnalyticsPageHeader analyticsBillingEnabled={analyticsBillingEnabled} />
            {isLoading ? (
                <div className={cn(BORDER_STYLES, "border-border w-full max-w-[1200px] border")}>
                    <div className="mb-6 flex w-full items-center justify-between">
                        <Skeleton className="h-7 w-32" />
                        <Skeleton className="h-9 w-32" />
                    </div>

                    <div className="mb-6 flex w-full gap-6">
                        {Array.from({ length: 4 }).map((_, i) => (
                            <div key={i} className="flex flex-1 flex-col items-start">
                                <Skeleton className="mb-1 h-5 w-20" />
                                <Skeleton className="h-7 w-16" />
                            </div>
                        ))}
                    </div>

                    <div className="mb-6 w-full overflow-x-auto">
                        <AnalyticsHistogramSkeleton />
                    </div>

                    <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                        <Skeleton className="h-9 w-64" />
                        <Skeleton className="h-9 w-32" />
                    </div>

                    <div className="flex flex-col gap-2">
                        <Skeleton className="h-10 w-full" />
                        {Array.from({ length: 8 }).map((_, i) => (
                            <Skeleton key={i} className="h-12 w-full" />
                        ))}
                    </div>
                </div>
            ) : (
                <ConversationsCard
                    histogramData={histogramData}
                    resolutionData={resolutionData}
                    timeRange={timeRange}
                    onTimeRangeChange={setTimeRange}
                    onBarClick={handleBarClick}
                    queries={queriesData}
                    baseDocsUrl={baseDocsUrl}
                    onSelectConversation={handleSelectConversation}
                    selectedConversation={selectedConversation}
                    totalPages={totalQueriesPages}
                    currentPage={currentPage}
                    setCurrentPage={setCurrentPage}
                    isLoading={isLoading}
                    cutoffTime={cutoffTime}
                />
            )}
        </div>
    );
}
