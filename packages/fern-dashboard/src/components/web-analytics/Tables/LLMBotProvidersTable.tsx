"use client";

import { useMemo } from "react";

import { useAnalyticsData } from "../AnalyticsDataContext";
import { ANALYTICS_SORT_DIR } from "../constants";
import { useAnalyticsTable } from "../hooks/useAnalyticsTable";
import AnalyticsMiniTable from "./AnalyticsMiniTable";

export default function LLMBotProvidersTable() {
    const { data, isLoading, error } = useAnalyticsData();
    const { sortState, handleSort } = useAnalyticsTable();

    const sortedProviders = useMemo(() => {
        if (!data?.llmBotTraffic) {
            return undefined;
        }
        const providers = [...data.llmBotTraffic];
        providers.sort((a, b) => (sortState.order === ANALYTICS_SORT_DIR.DESC ? b.count - a.count : a.count - b.count));
        return providers;
    }, [data?.llmBotTraffic, sortState]);

    const columns = [
        {
            key: "provider",
            label: "",
            width: "auto"
        },
        {
            key: "count",
            label: "Requests",
            width: "90px",
            sortable: true,
            format: (value: number) => value.toLocaleString()
        }
    ];

    return (
        <AnalyticsMiniTable
            title="LLM Bot Traffic by Provider"
            data={sortedProviders}
            isLoading={isLoading}
            error={error}
            columns={columns}
            getItemKey={(item) => item.provider}
            showGradient={true}
            gradientKey="count"
            onSort={handleSort}
            maxLength={45}
            defaultSortField="count"
        />
    );
}
