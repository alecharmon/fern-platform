"use client";

import { useQuery } from "@tanstack/react-query";

import type { TableRequest } from "@/app/actions/getWebAnalytics";
import { getLLMBotTrafficByProvider } from "@/app/actions/getWebAnalytics";

import { useAnalyticsTable } from "../hooks/useAnalyticsTable";
import AnalyticsMiniTable from "./AnalyticsMiniTable";

interface LLMBotProvidersTableProps {
    docsUrl: string;
    dateRange?: TableRequest["dateRange"];
    includeInternal?: boolean;
}

export default function LLMBotProvidersTable({ docsUrl, dateRange, includeInternal }: LLMBotProvidersTableProps) {
    const { sortState, handleSort } = useAnalyticsTable();

    const { data, isLoading, error } = useQuery({
        queryKey: ["llm-bot-providers", docsUrl, dateRange, includeInternal, sortState],
        queryFn: () =>
            getLLMBotTrafficByProvider({
                docsUrl,
                dateRange,
                includeInternal,
                order: sortState.order,
                limit: 10
            }),
        staleTime: 1000 * 60 * 5,
        refetchOnWindowFocus: false
    });

    const providers = data?.providers ?? [];

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
            data={providers}
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
