"use client";

import { useQuery } from "@tanstack/react-query";

import type { LLMFileViewsRequest } from "@/app/actions/getWebAnalytics";
import { getLLMFileViews } from "@/app/actions/getWebAnalytics";

import { ANALYTICS_COLUMNS } from "../constants";
import { useAnalyticsTable } from "../hooks/useAnalyticsTable";
import AnalyticsMiniTable from "./AnalyticsMiniTable";

interface LLMFileViewsTableProps {
    docsUrl: string;
    dateRange?: LLMFileViewsRequest["dateRange"];
    includeInternal?: boolean;
}

export default function LLMFileViewsTable({ docsUrl, dateRange, includeInternal }: LLMFileViewsTableProps) {
    const { sortState, handleSort } = useAnalyticsTable({
        defaultSortField: "agentViews",
        validSortFields: ["agentViews", "humanViews"]
    });

    const { data, isLoading, error } = useQuery({
        queryKey: ["llmFileViews", docsUrl, dateRange, includeInternal, sortState],
        queryFn: () =>
            getLLMFileViews({
                docsUrl,
                dateRange,
                includeInternal,
                orderBy: sortState.field as "agentViews" | "humanViews",
                order: sortState.order as "asc" | "desc",
                limit: 10
            }),
        staleTime: 1000 * 60 * 5, // 5 minutes
        refetchOnWindowFocus: false
    });

    const columns = [
        {
            key: "path",
            label: "",
            width: "auto"
        },
        ANALYTICS_COLUMNS.agentViews,
        ANALYTICS_COLUMNS.humanViews
    ];

    return (
        <AnalyticsMiniTable
            title=".md + llms.txt Visitors"
            data={data?.llmFileViews}
            isLoading={isLoading}
            error={error}
            columns={columns}
            getItemKey={(item) => item.path}
            showGradient={true}
            gradientKey={sortState.field}
            onSort={handleSort}
            maxLength={28}
            defaultSortField={"agentViews"}
        />
    );
}
