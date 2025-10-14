"use client";

import { useQuery } from "@tanstack/react-query";

import type { TableRequest } from "@/app/actions/getWebAnalytics";
import { get404Pages } from "@/app/actions/getWebAnalytics";

import { useAnalyticsTable } from "../hooks/useAnalyticsTable";
import AnalyticsMiniTable from "./AnalyticsMiniTable";

interface NotFoundPagesTableProps {
    docsUrl: string;
    dateRange?: TableRequest["dateRange"];
}

export default function NotFoundPagesTable({ docsUrl, dateRange }: NotFoundPagesTableProps) {
    const { sortState, handleSort } = useAnalyticsTable();

    const { data, isLoading, error } = useQuery({
        queryKey: ["404Pages", docsUrl, dateRange, sortState],
        queryFn: () =>
            get404Pages({
                docsUrl,
                dateRange,
                orderBy: sortState.field,
                order: sortState.order,
                limit: 10
            }),
        staleTime: 1000 * 60 * 5, // 5 minutes
        refetchOnWindowFocus: false
    });

    const filteredData = data?.pages404 ?? [];

    const columns = [
        {
            key: "path",
            label: "",
            width: "auto"
        },
        {
            key: "count",
            label: "Count",
            width: "100px",
            sortable: true,
            format: (value: number) => new Intl.NumberFormat("en-US").format(value)
        }
    ];

    if (!filteredData.length) {
        return null;
    }

    return (
        <AnalyticsMiniTable
            title="404 Pages"
            data={filteredData}
            isLoading={isLoading}
            error={error}
            columns={columns}
            getItemKey={(item) => item.path}
            showGradient={true}
            gradientKey={sortState.field}
            barVariant="red"
            onSort={handleSort}
            maxLength={45}
            defaultSortField={"count"}
        />
    );
}
