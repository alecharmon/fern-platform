"use client";

import { useQuery } from "@tanstack/react-query";
import type { TableRequest } from "@/app/actions/getWebAnalytics";
import { getDeviceTypes } from "@/app/actions/getWebAnalytics";

import { ANALYTICS_COLUMNS } from "../constants";
import { useAnalyticsTable } from "../hooks/useAnalyticsTable";
import AnalyticsMiniTable from "./AnalyticsMiniTable";

interface DeviceTypesTableProps {
    docsUrl: string;
    dateRange?: TableRequest["dateRange"];
    includeInternal?: boolean;
}

const deviceEmojis: Record<string, string> = {
    Desktop: "🖥️",
    Mobile: "📱",
    Tablet: "📟",
    Console: "🎮",
    TV: "📺"
};

export default function DeviceTypesTable({ docsUrl, dateRange, includeInternal }: DeviceTypesTableProps) {
    const { sortState, handleSort } = useAnalyticsTable();

    const { data, isLoading, error } = useQuery({
        queryKey: ["deviceTypes", docsUrl, dateRange, includeInternal, sortState],
        queryFn: () =>
            getDeviceTypes({
                docsUrl,
                dateRange,
                includeInternal,
                orderBy: sortState.field,
                order: sortState.order,
                limit: 10
            }),
        staleTime: 1000 * 60 * 5, // 5 minutes
        refetchOnWindowFocus: false
    });

    const columns = [
        {
            key: "deviceType",
            label: "",
            width: "auto",
            render: (item: { deviceType: string }) => {
                const emoji = deviceEmojis[item.deviceType] || "📱";
                return `${emoji}  ${item.deviceType}`;
            }
        },
        ANALYTICS_COLUMNS.visitors,
        ANALYTICS_COLUMNS.views
    ];

    return (
        <AnalyticsMiniTable
            title="Device Type"
            data={data?.deviceTypes}
            isLoading={isLoading}
            error={error}
            columns={columns}
            getItemKey={(item) => item.deviceType}
            showGradient={true}
            gradientKey={sortState.field}
            onSort={handleSort}
            maxLength={45}
        />
    );
}
