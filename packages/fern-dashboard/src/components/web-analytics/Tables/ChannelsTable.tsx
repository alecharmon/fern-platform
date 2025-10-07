"use client";

import { useQuery } from "@tanstack/react-query";

import { getChannels } from "@/app/actions/getWebAnalytics";
import type { TableRequest } from "@/app/actions/getWebAnalytics";

import { ANALYTICS_COLUMNS } from "../constants";
import { useAnalyticsTable } from "../hooks/useAnalyticsTable";
import AnalyticsMiniTable from "./AnalyticsMiniTable";

interface ChannelsTableProps {
    docsUrl: string;
    dateRange?: TableRequest["dateRange"];
    includeInternal?: boolean;
}

export default function ChannelsTable({ docsUrl, dateRange, includeInternal }: ChannelsTableProps) {
    const { sortState, handleSort } = useAnalyticsTable();

    const { data, isLoading, error } = useQuery({
        queryKey: ["channels", docsUrl, dateRange, includeInternal, sortState],
        queryFn: () =>
            getChannels({
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
            key: "channel",
            label: "",
            width: "auto"
        },
        ANALYTICS_COLUMNS.visitors,
        ANALYTICS_COLUMNS.views
    ];

    return (
        <AnalyticsMiniTable
            title="Channels"
            data={data?.channels}
            isLoading={isLoading}
            error={error}
            columns={columns}
            getItemKey={(item) => item.channel}
            showGradient={true}
            gradientKey={sortState.field}
            onSort={handleSort}
            maxLength={45}
        />
    );
}
