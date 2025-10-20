"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { RefreshCwIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { clearAlgoliaAnalyticsCache, getSearchMetrics } from "@/app/actions/getAlgoliaAnalytics";
import type { DateRangeOptions } from "@/app/services/algolia-analytics/types";

import { Button } from "../ui/button";
import SelectDate from "../web-analytics/SelectDate";
import { SearchMetricsCard } from "./SearchMetricsCard";
import SearchAnalyticsTables from "./Tables";

export default function SearchAnalyticsPage() {
    const [dateRange, setDateRange] = useState<DateRangeOptions>({
        type: "last_n_days",
        days: 7
    });

    const queryClient = useQueryClient();

    const { data, isLoading, error } = useQuery({
        queryKey: ["search-metrics", dateRange],
        queryFn: () =>
            getSearchMetrics({
                dateRange
            }),
        refetchInterval: 60000 // Refetch every minute
    });

    const refreshMutation = useMutation({
        mutationFn: async () => {
            await clearAlgoliaAnalyticsCache();
        },
        onSuccess: async () => {
            // Invalidate all search analytics queries to force refetch
            await queryClient.invalidateQueries({ queryKey: ["search-metrics"] });
            await queryClient.invalidateQueries({ queryKey: ["top-searches"] });
            await queryClient.invalidateQueries({
                queryKey: ["no-results-searches"]
            });
            toast.success("Search analytics refreshed");
        },
        onError: (error) => {
            console.error("Failed to refresh search analytics", error);
            toast.error("Failed to refresh search analytics");
        }
    });

    return (
        <div className="flex w-full flex-col gap-4">
            {/* Date Range and Refresh Button */}
            <div className="flex items-center gap-2">
                <SelectDate value={dateRange} onChange={setDateRange} />
                <Button
                    variant="outline"
                    size="default"
                    onClick={() => refreshMutation.mutate()}
                    disabled={refreshMutation.isPending}
                    className="border-border shadow-xs dark:border-border dark:hover:bg-input/50 gap-2 bg-white px-3 py-1.5 text-sm dark:bg-transparent"
                >
                    <RefreshCwIcon className={`size-4 ${refreshMutation.isPending ? "animate-spin" : ""}`} />
                    Refresh
                </Button>
            </div>

            {/* Total Searches Metric */}
            <div className="flex gap-4">
                <SearchMetricsCard
                    title="Total searches"
                    value={data?.searchCount ?? 0}
                    isLoading={isLoading}
                    error={error}
                    tooltip={
                        <div className="flex max-w-[250px] text-left">
                            Number of searches performed. <br />
                            As-you-type searches are aggregated (i.e. the queries &apos;b&apos;, &apos;ba&apos;,
                            &apos;ban&apos;, &apos;bana&apos; & &apos;banana&apos; count as one search).
                        </div>
                    }
                />
            </div>

            {/* Analytics Tables - Top Searches and No Results */}
            <SearchAnalyticsTables dateRange={dateRange} />
        </div>
    );
}
