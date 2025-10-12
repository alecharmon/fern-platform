"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { getWebAnalytics } from "@/app/actions/getWebAnalytics";
import type { DateRangeOptions } from "@/app/services/posthog/types";

import WebAnalyticsChart from "./Chart";
import SelectDate from "./SelectDate";
import AnalyticsTables from "./Tables";

interface WebAnalyticsPageProps {
    docsUrl: string;
}

export default function WebAnalyticsPage({ docsUrl }: WebAnalyticsPageProps) {
    const [dateRange, setDateRange] = useState<DateRangeOptions>({
        type: "last_n_days",
        days: 7
    });
    const [groupBy, setGroupBy] = useState<number>(1);

    const { data, isLoading, error } = useQuery({
        queryKey: ["web-analytics", docsUrl, dateRange, groupBy],
        queryFn: () =>
            getWebAnalytics({
                docsUrl,
                dateRange,
                groupBy
            }),
        refetchInterval: 60000 // Refetch every minute
    });

    return (
        <div className="flex w-full flex-col gap-6">
            {/* Date Range and GroupBy Selectors */}
            <SelectDate value={dateRange} onChange={setDateRange} />

            {/* Metrics Cards using CSS Grid for equal 1/2 spacing */}
            <div className="flex justify-between">
                <MetricCard title="Visitors" value={data?.metrics.visitors ?? 0} isLoading={isLoading} error={error} />
                <MetricCard
                    title="Page views"
                    value={data?.metrics.pageViews ?? 0}
                    isLoading={isLoading}
                    error={error}
                />
            </div>

            {/* Page Views Area Chart */}
            <WebAnalyticsChart dateRange={dateRange} docsUrl={docsUrl} groupBy={groupBy} setGroupBy={setGroupBy} />

            {/* Analytics Tables - Top Pages, Countries, and LLM Files */}
            <AnalyticsTables docsUrl={docsUrl} dateRange={dateRange} />
        </div>
    );
}

interface MetricCardProps {
    title: string;
    value: number;
    isLoading: boolean;
    error: Error | null;
}

function MetricCard({ title, value, isLoading, error }: MetricCardProps) {
    return (
        <div className="border-border flex w-[48%] flex-col gap-3 rounded-lg border bg-white p-6 dark:bg-transparent">
            <p className="text-muted-foreground text-sm">{title}</p>
            <div className="text-3xl font-semibold">
                {isLoading ? (
                    <div className="h-9 w-32 animate-pulse rounded bg-gray-200 dark:bg-transparent" />
                ) : error ? (
                    <span className="text-destructive text-base">Error loading data</span>
                ) : (
                    new Intl.NumberFormat("en-US").format(value)
                )}
            </div>
        </div>
    );
}
