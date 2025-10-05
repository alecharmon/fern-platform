"use client";

import { useState } from "react";

import type { FernAI } from "@fern-api/fai-sdk";

import { getAllQueries } from "@/app/actions/getAllQueries";
import { cn } from "@/utils/utils";

import { Pagination } from "../ui/pagination";
import { BORDER_STYLES } from "./AnalyticsPageClient";
import { columns } from "./ConversationColumnDef";
import { QueriesDataTable } from "./QueriesDataTable";
import { exportToCSV } from "./utils/export-to-csv";
import type { TimeRange } from "./utils/get-request-params";

export function QueriesTable({
    queries,
    baseDocsUrl,
    onSelectConversation,
    selectedConversation,
    totalPages,
    currentPage,
    setCurrentPage,
    isLoading,
    queryTimeRange,
    setQueryTimeRange,
    cutoffTime
}: {
    queries: FernAI.Query[];
    baseDocsUrl: string;
    onSelectConversation: (conversation: FernAI.Conversation) => void;
    selectedConversation: FernAI.Conversation | null;
    totalPages: number;
    currentPage: number;
    setCurrentPage: (page: number) => void;
    isLoading: boolean;
    queryTimeRange: TimeRange;
    setQueryTimeRange: (range: TimeRange) => void;
    cutoffTime: string;
}) {
    const [isExporting, setIsExporting] = useState(false);

    const handleExport = () => {
        setIsExporting(true);
        getAllQueries({
            domain: baseDocsUrl,
            cutoffTime,
            timeRange: queryTimeRange
        })
            .then((allData) => {
                exportToCSV(allData.queries, `all-queries-${queryTimeRange.toLowerCase()}`);
            })
            .catch((error) => {
                console.error("Failed to export CSV:", error);
            })
            .finally(() => {
                setIsExporting(false);
            });
    };

    return (
        <div className={cn(BORDER_STYLES, "border-gray-0 w-full overflow-hidden border")}>
            <QueriesDataTable
                columns={columns}
                data={queries}
                baseDocsUrl={baseDocsUrl}
                onSelectConversation={onSelectConversation}
                selectedConversation={selectedConversation}
                queryTimeRange={queryTimeRange}
                setQueryTimeRange={setQueryTimeRange}
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
