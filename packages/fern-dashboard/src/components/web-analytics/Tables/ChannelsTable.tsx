"use client";

import { useMemo } from "react";

import { useAnalyticsData } from "../AnalyticsDataContext";
import { ANALYTICS_COLUMNS, ANALYTICS_FIELDS, ANALYTICS_SORT_DIR } from "../constants";
import { useAnalyticsTable } from "../hooks/useAnalyticsTable";
import AnalyticsMiniTable from "./AnalyticsMiniTable";

export default function ChannelsTable() {
    const { data, isLoading, error } = useAnalyticsData();
    const { sortState, handleSort } = useAnalyticsTable();

    const sortedChannels = useMemo(() => {
        if (!data?.channels) {
            return undefined;
        }
        const channels = [...data.channels];
        if (sortState.field === ANALYTICS_FIELDS.VISITORS) {
            channels.sort((a, b) =>
                sortState.order === ANALYTICS_SORT_DIR.DESC ? b.visitors - a.visitors : a.visitors - b.visitors
            );
        } else if (sortState.field === ANALYTICS_FIELDS.VIEWS) {
            channels.sort((a, b) =>
                sortState.order === ANALYTICS_SORT_DIR.DESC ? b.views - a.views : a.views - b.views
            );
        }
        return channels;
    }, [data?.channels, sortState]);

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
            data={sortedChannels}
            isLoading={isLoading}
            error={error}
            columns={columns}
            getItemKey={(item) => item.channel}
            showGradient={true}
            gradientKey={sortState.field}
            onSort={handleSort}
            maxLength={45}
            defaultSortField={ANALYTICS_FIELDS.VISITORS}
        />
    );
}
