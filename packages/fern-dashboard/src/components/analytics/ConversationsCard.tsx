"use client";

import type { FernAI } from "@fern-api/fai-sdk";
import { useMemo, useState } from "react";

import { getAllQueries } from "@/app/actions/getAllQueries";
import { cn } from "@/utils/utils";

import { Pagination } from "../ui/pagination";
import { AnalyticsHistogramChart } from "./AnalyticsHistogramChart";
import { BORDER_STYLES } from "./AnalyticsPageClient";
import { AnimatedStatistic } from "./AnimatedStatistic";
import { columns } from "./ConversationColumnDef";
import { QueriesDataTable } from "./QueriesDataTable";
import { type TimeRangeOption, TimeRangeSelect } from "./TimeRangeSelect";
import { groupQueriesByConversation } from "./types";
import { exportToCSV } from "./utils/export-to-csv";
import { TimeRange } from "./utils/get-request-params";
import { parseLabel } from "./utils/parse-label";

const ANALYTICS_TIME_RANGE_OPTIONS: TimeRangeOption[] = [
    { label: "Last Week", value: TimeRange.LAST_WEEK },
    { label: "Last Month", value: TimeRange.LAST_MONTH },
    { label: "Last Year", value: TimeRange.LAST_YEAR }
];

interface ConversationsCardProps {
    histogramData: FernAI.GetHistogramAnalyticsResponse;
    resolutionData: FernAI.GetConversationResolutionResponse;
    timeRange: TimeRange;
    onTimeRangeChange: (range: TimeRange) => void;
    onBarClick?: (barIndex: number) => void;
    queries: FernAI.Query[];
    baseDocsUrl: string;
    onSelectConversation: (conversation: FernAI.Conversation) => void;
    selectedConversation: FernAI.Conversation | null;
    totalPages: number;
    currentPage: number;
    setCurrentPage: (page: number) => void;
    isLoading: boolean;
    cutoffTime: string;
}

export function ConversationsCard({
    histogramData,
    resolutionData,
    timeRange,
    onTimeRangeChange,
    onBarClick,
    queries,
    baseDocsUrl,
    onSelectConversation,
    selectedConversation,
    totalPages,
    currentPage,
    setCurrentPage,
    isLoading,
    cutoffTime
}: ConversationsCardProps) {
    const [selectedBarIndex, setSelectedBarIndex] = useState<number | null>(null);
    const [isExporting, setIsExporting] = useState(false);

    const chartData = histogramData.bars.map((bar) => ({
        displayLabel: parseLabel(bar.label),
        count: bar.conversationCount
    }));

    const conversationRows = useMemo(() => groupQueriesByConversation(queries), [queries]);

    const handleBarClick = (index: number) => {
        setSelectedBarIndex(index === selectedBarIndex ? null : index);
        onBarClick?.(index);
    };

    const handleExport = () => {
        setIsExporting(true);
        getAllQueries({
            domain: baseDocsUrl,
            cutoffTime,
            timeRange: timeRange
        })
            .then((allData) => {
                const allConversationRows = groupQueriesByConversation(allData.queries);
                exportToCSV(allConversationRows, `all-conversations-${timeRange.toLowerCase()}`);
            })
            .catch((error) => {
                console.error("Failed to export CSV:", error);
            })
            .finally(() => {
                setIsExporting(false);
            });
    };

    const { total_conversations, resolved_conversations, unresolved_conversations, resolution_rate } = resolutionData;

    const getResolutionRateColor = () => {
        if (resolution_rate === 0) return "";
        if (resolution_rate > 80) return "text-primary";
        if (resolution_rate >= 60) return "text-yellow-1100";
        return "text-destructive";
    };

    return (
        <div className={cn(BORDER_STYLES, "border-gray-0 w-full max-w-[1200px] border")}>
            <div className="mb-6 flex w-full items-center justify-between">
                <h2 className="text-xl font-semibold">Conversations</h2>
                <TimeRangeSelect
                    value={timeRange}
                    onChange={onTimeRangeChange}
                    options={ANALYTICS_TIME_RANGE_OPTIONS}
                />
            </div>

            <div className="mb-6 flex w-full gap-6">
                <AnimatedStatistic label="Total" value={total_conversations} />
                <AnimatedStatistic
                    label="Resolved"
                    value={resolved_conversations}
                    colorClass={resolved_conversations > 0 ? "text-primary" : ""}
                />
                <AnimatedStatistic
                    label="Unresolved"
                    value={unresolved_conversations}
                    colorClass={unresolved_conversations > 0 ? "text-destructive" : ""}
                />
                <AnimatedStatistic
                    label="Resolution rate"
                    value={resolution_rate}
                    suffix="%"
                    decimals={1}
                    colorClass={getResolutionRateColor()}
                />
            </div>

            <div className="mb-6 w-full overflow-x-auto">
                <AnalyticsHistogramChart
                    chartData={chartData}
                    renderType="CONVERSATIONS"
                    onBarClick={handleBarClick}
                    selectedBarIndex={selectedBarIndex}
                />
            </div>

            <QueriesDataTable
                columns={columns}
                data={conversationRows}
                baseDocsUrl={baseDocsUrl}
                onSelectConversation={onSelectConversation}
                selectedConversation={selectedConversation}
                onExport={handleExport}
                isExporting={isExporting}
            />
            <Pagination
                totalPages={totalPages}
                currentPage={currentPage}
                setCurrentPage={setCurrentPage}
                isLoading={isLoading}
            />
        </div>
    );
}
