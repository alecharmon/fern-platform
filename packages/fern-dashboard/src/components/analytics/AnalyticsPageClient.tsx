"use client";

import React, { useEffect, useState } from "react";

import { FernFai } from "@fern-api/fai-sdk";

import { getDomainAnalytics } from "@/app/actions/getAnalytics";
import { getQueries } from "@/app/actions/getQueries";
import { useSidepanel } from "@/components/layout/SidepanelContext";
import { Skeleton } from "@/components/ui/skeleton";

import { AnalyticsHistogram } from "./AnalyticsHistogram";
import { AnalyticsHistogramSkeleton } from "./AnalyticsHistogramSkeleton";
import { ITEMS_PER_PAGE } from "./AnalyticsPage";
import { AnalyticsPageHeader } from "./AnalyticsPageHeader";
import { ConversationSidePanel } from "./ConversationSidePanel";
import { QueriesTable } from "./QueriesTable";
import { TimeRange } from "./utils/get-request-params";

export type RenderType = "QUERIES" | "CONVERSATIONS";

const ANALYTICS_PAGE_STYLES =
  "flex min-w-0 flex-1 flex-col items-center transition-[flex] duration-500 ease-out";
export const BORDER_STYLES =
  "mb-4 flex w-full flex-col items-center rounded-2xl p-4";

export function AnalyticsPageClient({
  baseDocsUrl,
  initialQueriesData,
  initialHistogramData,
  initialTotalQueries,
  cutoffTime,
  analyticsBillingEnabled,
}: {
  baseDocsUrl: string;
  initialQueriesData: FernFai.Query[];
  initialHistogramData: FernFai.HistogramAnalytics;
  initialTotalQueries: number;
  cutoffTime: string;
  analyticsBillingEnabled: boolean;
}) {
  const [renderType, setRenderType] = useState<RenderType>("QUERIES");
  const [histogramTimeRange, setHistogramTimeRange] = useState<TimeRange>(
    TimeRange.LAST_WEEK
  );
  const [histogramData, setHistogramData] = useState(initialHistogramData);
  const [queryTimeRange, setQueryTimeRange] = useState<TimeRange>(
    TimeRange.LAST_WEEK
  );
  const [queriesData, setQueriesData] = useState(initialQueriesData);
  const [totalQueriesPages, setTotalQueriesPages] = useState(
    Math.ceil(initialTotalQueries / ITEMS_PER_PAGE)
  );
  const [selectedConversation, setSelectedConversation] =
    useState<FernFai.Conversation | null>(null);
  const [isConversationLoading, setIsConversationLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [pageCache, setPageCache] = useState<Record<number, FernFai.Query[]>>(
    {}
  );
  const { setContent, clear } = useSidepanel();

  useEffect(() => {
    async function fetchHistogramData() {
      try {
        const data = await getDomainAnalytics({
          docsUrl: baseDocsUrl,
          timeRange: histogramTimeRange,
        });
        setHistogramData(data);
      } catch (error) {
        console.error("Failed to fetch histogram data:", error);
      }
    }

    void fetchHistogramData();
  }, [baseDocsUrl, histogramTimeRange]);

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
          timeRange: queryTimeRange,
        });

        setPageCache((prev) => ({
          ...prev,
          [currentPage]: response.queries,
        }));

        setQueriesData(response.queries);
        setTotalQueriesPages(Math.ceil(response.total / ITEMS_PER_PAGE));
      } catch (error) {
        console.error("Failed to fetch queries data:", error);
      } finally {
        setIsLoading(false);
      }
    }

    void fetchQueriesData();
  }, [baseDocsUrl, currentPage, queryTimeRange, cutoffTime, pageCache]);

  useEffect(() => {
    setPageCache({});
  }, [queryTimeRange, cutoffTime]);

  const timeoutRef = React.useRef<number | null>(null);

  function handleSelectConversation(convo: FernFai.Conversation | null) {
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
        <div className="mb-4 flex w-full max-w-[1200px] flex-col gap-4">
          <div className="border-border flex flex-col gap-2 rounded-xl border p-4">
            <AnalyticsHistogramSkeleton />
          </div>
          <div className="border-border flex flex-col gap-2 rounded-xl border p-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        </div>
      ) : (
        <>
          <AnalyticsHistogram
            renderType={renderType}
            setRenderType={setRenderType}
            histogramTimeRange={histogramTimeRange}
            setHistogramTimeRange={setHistogramTimeRange}
            histogramData={histogramData}
          />
          <QueriesTable
            queries={queriesData}
            baseDocsUrl={baseDocsUrl}
            onSelectConversation={handleSelectConversation}
            selectedConversation={selectedConversation}
            totalPages={totalQueriesPages}
            currentPage={currentPage}
            setCurrentPage={setCurrentPage}
            isLoading={isLoading}
            cutoffTime={cutoffTime}
            queryTimeRange={queryTimeRange}
            setQueryTimeRange={setQueryTimeRange}
          />
        </>
      )}
    </div>
  );
}
