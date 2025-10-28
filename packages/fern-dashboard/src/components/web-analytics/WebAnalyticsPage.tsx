"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { RefreshCwIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { getDocsGithubMetadata } from "@/app/actions/getDocsGithubMetadata";
import { clearWebAnalyticsCache, getWebAnalytics } from "@/app/actions/getWebAnalytics";
import type { DateRangeOptions } from "@/app/services/posthog/types";
import type { DocsUrl } from "@/utils/types";

import { Button } from "../ui/button";
import WebAnalyticsChart from "./Chart";
import { MetricsCard } from "./MetricsCard";
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

    const { data: githubMetadata } = useQuery({
        queryKey: ["docs-github-metadata", docsUrl],
        queryFn: () => getDocsGithubMetadata(docsUrl),
        staleTime: 1000 * 60 * 10 // 10 minutes
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
        <div className="flex w-full flex-col gap-4">
            {/* Date Range and Refresh Button */}
            <div className="flex items-center gap-2">
                <SelectDate value={dateRange} onChange={setDateRange} />
                <Button
                    variant="outline"
                    size="default"
                    onClick={() => refreshMutation.mutate()}
                    disabled={refreshMutation.isPending}
                    className="border-border shadow-xs gap-2 bg-white px-3 py-1.5 text-sm dark:border-border dark:bg-transparent dark:hover:bg-input/50"
                >
                    <RefreshCwIcon className={`size-4 ${refreshMutation.isPending ? "animate-spin" : ""}`} />
                    Refresh
                </Button>
            </div>

            {/* Metrics Cards */}
            <div className="flex gap-4">
                <MetricsCard
                    title="Visitors"
                    value={data?.metrics.visitors ?? 0}
                    isLoading={isLoading}
                    error={error}
                    className="flex-1"
                />
                <MetricsCard
                    title="Page views"
                    value={data?.metrics.pageViews ?? 0}
                    isLoading={isLoading}
                    error={error}
                    className="flex-1"
                />
            </div>

            <WebAnalyticsChart dateRange={dateRange} docsUrl={docsUrl} groupBy={groupBy} setGroupBy={setGroupBy} />

            {/* Analytics Tables - Top Pages, Countries, and LLM Files */}
            <AnalyticsTables
                docsUrl={docsUrl as DocsUrl}
                dateRange={dateRange}
                orgName={githubMetadata?.orgName}
                githubUrl={githubMetadata?.githubUrl}
                baseBranch={githubMetadata?.baseBranch}
            />
        </div>
    );
}
