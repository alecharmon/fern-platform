"use client";

import { useMemo } from "react";

import { useAnalyticsData } from "../AnalyticsDataContext";
import { ANALYTICS_COLUMNS, ANALYTICS_SORT_DIR } from "../constants";
import { useAnalyticsTable } from "../hooks/useAnalyticsTable";
import AnalyticsMiniTable from "./AnalyticsMiniTable";

export default function LLMFileViewsTable() {
    const { data, isLoading, error } = useAnalyticsData();
    const { sortState, handleSort } = useAnalyticsTable({
        defaultSortField: "agentViews",
        validSortFields: ["agentViews", "humanViews"]
    });

    const sortedLLMFileViews = useMemo(() => {
        if (!data?.llmFileViews) {
            return undefined;
        }
        const fileViews = [...data.llmFileViews];
        if (sortState.field === "agentViews") {
            fileViews.sort((a, b) =>
                sortState.order === ANALYTICS_SORT_DIR.DESC ? b.agentViews - a.agentViews : a.agentViews - b.agentViews
            );
        } else if (sortState.field === "humanViews") {
            fileViews.sort((a, b) =>
                sortState.order === ANALYTICS_SORT_DIR.DESC ? b.humanViews - a.humanViews : a.humanViews - b.humanViews
            );
        }
        return fileViews;
    }, [data?.llmFileViews, sortState]);

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
            data={sortedLLMFileViews}
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
