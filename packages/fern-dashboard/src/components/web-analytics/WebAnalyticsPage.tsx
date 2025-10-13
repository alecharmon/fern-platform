"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { RefreshCwIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { clearWebAnalyticsCache, getWebAnalytics } from "@/app/actions/getWebAnalytics";
import type { DateRangeOptions } from "@/app/services/posthog/types";

import { Button } from "../ui/button";
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

    const queryClient = useQueryClient();

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

    const refreshMutation = useMutation({
        mutationFn: async () => {
            await clearWebAnalyticsCache(docsUrl);
        },
        onSuccess: async () => {
            // Invalidate all web analytics queries to force refetch
            await queryClient.invalidateQueries({ queryKey: ["web-analytics"] });
            toast.success("Analytics refreshed");
        },
        onError: (error) => {
            console.error("Failed to refresh analytics", error);
            toast.error("Failed to refresh analytics");
        }
    });

    return (
        <div className="flex w-full flex-col gap-6">
            {/* Date Range and Refresh Button */}
            <div className="flex items-center gap-2">
                <SelectDate value={dateRange} onChange={setDateRange} />
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => refreshMutation.mutate()}
                    disabled={refreshMutation.isPending}
                    className="gap-2"
                >
                    <RefreshCwIcon className={`size-4 ${refreshMutation.isPending ? "animate-spin" : ""}`} />
                    Refresh
                </Button>
            </div>

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
