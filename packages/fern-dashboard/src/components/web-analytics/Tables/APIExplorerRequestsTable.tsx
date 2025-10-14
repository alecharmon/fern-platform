"use client";

import { useQuery } from "@tanstack/react-query";

import type { TableRequest } from "@/app/actions/getWebAnalytics";
import { getAPIExplorerRequests } from "@/app/actions/getWebAnalytics";

import { useAnalyticsTable } from "../hooks/useAnalyticsTable";
import AnalyticsMiniTable from "./AnalyticsMiniTable";

interface APIExplorerRequestsTableProps {
    docsUrl: string;
    dateRange?: TableRequest["dateRange"];
    includeInternal?: boolean;
}

const METHOD_COLORS: Record<string, "blue" | "green" | "yellow" | "red"> = {
    GET: "green",
    POST: "blue",
    PUT: "yellow",
    PATCH: "yellow",
    DELETE: "red"
};

export default function APIExplorerRequestsTable({
    docsUrl,
    dateRange,
    includeInternal
}: APIExplorerRequestsTableProps) {
    const { sortState, handleSort } = useAnalyticsTable();

    const { data, isLoading, error } = useQuery({
        queryKey: ["apiExplorerRequests", docsUrl, dateRange, includeInternal, sortState],
        queryFn: () =>
            getAPIExplorerRequests({
                docsUrl,
                dateRange,
                includeInternal,
                order: sortState.order,
                limit: 20
            }),
        staleTime: 1000 * 60 * 5, // 5 minutes
        refetchOnWindowFocus: false
    });

    const columns = [
        {
            key: "endpoint",
            label: "",
            width: "auto",
            render: (item: { method: string; endpoint: string; name: string }, _index: number) => {
                const methodColor = METHOD_COLORS[item.method] || "blue";

                // Map to specific hex colors
                const badgeColor =
                    methodColor === "blue"
                        ? "#0190FF"
                        : methodColor === "green"
                          ? "#22C55E" // Tailwind green-500
                          : methodColor === "yellow"
                            ? "#FFBA18"
                            : "#EF4444"; // Tailwind red-500

                return (
                    <div className="relative flex items-center gap-2">
                        <span
                            className="py-0.25 relative z-10 inline-flex items-center rounded px-1 text-xs font-semibold text-white"
                            style={{ backgroundColor: badgeColor }}
                        >
                            {item.method}
                        </span>
                        <span className="relative z-10 truncate">{item.endpoint}</span>
                    </div>
                );
            }
        },
        {
            key: "count",
            label: "Count",
            width: "90px",
            sortable: true,
            format: (value: number) => value.toLocaleString()
        }
    ];

    // Transform data to add barVariant based on method
    const dataWithVariant = data?.apiExplorerRequests.map((item) => ({
        ...item,
        barVariant: METHOD_COLORS[item.method] || "blue"
    }));

    return (
        <AnalyticsMiniTable
            title="API Explorer requests"
            data={dataWithVariant}
            isLoading={isLoading}
            error={error}
            columns={columns}
            getItemKey={(item) => `${item.method}-${item.endpoint}`}
            showGradient={true}
            gradientKey="count"
            onSort={handleSort}
            maxLength={60}
            defaultSortField={"count"}
        />
    );
}
