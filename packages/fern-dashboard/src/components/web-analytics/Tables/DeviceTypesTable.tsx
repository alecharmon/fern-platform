"use client";

import { useMemo } from "react";

import { useAnalyticsData } from "../AnalyticsDataContext";
import { ANALYTICS_COLUMNS, ANALYTICS_FIELDS, ANALYTICS_SORT_DIR } from "../constants";
import { useAnalyticsTable } from "../hooks/useAnalyticsTable";
import AnalyticsMiniTable from "./AnalyticsMiniTable";

const deviceEmojis: Record<string, string> = {
    Desktop: "🖥️",
    Mobile: "📱",
    Tablet: "📟",
    Console: "🎮",
    TV: "📺"
};

export default function DeviceTypesTable() {
    const { data, isLoading, error } = useAnalyticsData();
    const { sortState, handleSort } = useAnalyticsTable();

    const sortedDeviceTypes = useMemo(() => {
        if (!data?.deviceTypes) {
            return undefined;
        }
        const deviceTypes = [...data.deviceTypes];
        if (sortState.field === ANALYTICS_FIELDS.VISITORS) {
            deviceTypes.sort((a, b) =>
                sortState.order === ANALYTICS_SORT_DIR.DESC ? b.visitors - a.visitors : a.visitors - b.visitors
            );
        } else if (sortState.field === ANALYTICS_FIELDS.VIEWS) {
            deviceTypes.sort((a, b) =>
                sortState.order === ANALYTICS_SORT_DIR.DESC ? b.views - a.views : a.views - b.views
            );
        }
        return deviceTypes;
    }, [data?.deviceTypes, sortState]);

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
            data={sortedDeviceTypes}
            isLoading={isLoading}
            error={error}
            columns={columns}
            getItemKey={(item) => item.deviceType}
            showGradient={true}
            gradientKey={sortState.field}
            onSort={handleSort}
            maxLength={45}
            defaultSortField={ANALYTICS_FIELDS.VISITORS}
        />
    );
}
