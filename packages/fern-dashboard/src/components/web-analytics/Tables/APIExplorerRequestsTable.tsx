"use client";

import { useMemo } from "react";

import { useAnalyticsData } from "../AnalyticsDataContext";
import { ANALYTICS_SORT_DIR } from "../constants";
import { useAnalyticsTable } from "../hooks/useAnalyticsTable";
import AnalyticsMiniTable from "./AnalyticsMiniTable";

const METHOD_COLORS: Record<string, "blue" | "green" | "yellow" | "red"> = {
    GET: "green",
    POST: "blue",
    PUT: "yellow",
    PATCH: "yellow",
    DELETE: "red"
};

export default function APIExplorerRequestsTable() {
    const { data, isLoading, error } = useAnalyticsData();
    const { sortState, handleSort } = useAnalyticsTable({
        defaultSortField: "count",
        validSortFields: ["count", "numSuccesses", "numFailures"]
    });

    const sortedAPIExplorerRequests = useMemo(() => {
        if (!data?.apiExplorerRequests) {
            return undefined;
        }
        const requests = [...data.apiExplorerRequests];

        // Sort based on the current sort field
        requests.sort((a, b) => {
            let aValue: number;
            let bValue: number;

            if (sortState.field === "numSuccesses") {
                aValue = a.numSuccesses;
                bValue = b.numSuccesses;
            } else if (sortState.field === "numFailures") {
                aValue = a.numFailures;
                bValue = b.numFailures;
            } else {
                // Default to count
                aValue = a.count;
                bValue = b.count;
            }

            return sortState.order === ANALYTICS_SORT_DIR.DESC ? bValue - aValue : aValue - bValue;
        });

        return requests;
    }, [data?.apiExplorerRequests, sortState]);

    const columns = [
        {
            key: "endpoint",
            label: "",
            width: "auto",
            render: (item: { host: string; method: string; endpoint: string; name: string }, _index: number) => {
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
                        <span className="relative z-10 truncate">{item.endpoint || item.name}</span>
                    </div>
                );
            }
        },
        {
            key: "numSuccesses",
            label: "Successes",
            width: "100px",
            sortable: true,
            format: (value: number) => value.toLocaleString()
        },
        {
            key: "numFailures",
            label: "Failures",
            width: "100px",
            sortable: true,
            format: (value: number) => value.toLocaleString()
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
    const dataWithVariant = sortedAPIExplorerRequests?.map((item) => ({
        ...item,
        host: "",
        barVariant: METHOD_COLORS[item.method] || "blue"
    }));

    return (
        <AnalyticsMiniTable
            title="API Explorer requests"
            titleInfo="Success and failure data has only recently been collected. There may be discrepancies in count totals."
            data={dataWithVariant}
            isLoading={isLoading}
            error={error}
            columns={columns}
            getItemKey={(item) => `${item.method}-${item.endpoint}-${item.name}`}
            showGradient={true}
            gradientKey={sortState.field || "count"}
            onSort={handleSort}
            maxLength={60}
            defaultSortField={"count"}
        />
    );
}
