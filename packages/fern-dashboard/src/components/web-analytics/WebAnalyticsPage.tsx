"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { RefreshCwIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { getDocsGithubMetadata } from "@/app/actions/getDocsGithubMetadata";
import { refreshWebAnalytics } from "@/app/actions/getWebAnalytics";
import type { DateRangeOptions } from "@/app/services/posthog/types";
import { parseDocsUrlParam } from "@/utils/parseDocsUrlParam";
import type { DocsUrl } from "@/utils/types";

import { Button } from "../ui/button";
import { AnalyticsDataProvider, useAnalyticsData } from "./AnalyticsDataContext";
import { useInvalidateAnalyticsCache } from "./api";
import WebAnalyticsChart from "./Chart";
import { MetricsCard } from "./MetricsCard";
import SelectDate from "./SelectDate";
import AnalyticsTables from "./Tables";

interface WebAnalyticsPageProps {
    docsUrl: string;
}

interface WebAnalyticsContentProps extends WebAnalyticsPageProps {
    dateRange: DateRangeOptions;
    setDateRange: (dateRange: DateRangeOptions) => void;
    groupBy: number | undefined;
    setGroupBy: (groupBy: number) => void;
}

function WebAnalyticsContent({ docsUrl, dateRange, setDateRange, groupBy, setGroupBy }: WebAnalyticsContentProps) {
    const { data, isLoading, error } = useAnalyticsData();
    const invalidateCache = useInvalidateAnalyticsCache();

    const { data: githubMetadataResult } = useQuery({
        queryKey: ["docs-github-metadata", docsUrl],
        queryFn: () => getDocsGithubMetadata(parseDocsUrlParam({ docsUrl })),
        staleTime: 1000 * 60 * 10 // 10 minutes
    });

    const { orgName, githubUrl, baseBranch } = githubMetadataResult?.success ? githubMetadataResult : {};

    const refreshMutation = useMutation({
        mutationFn: async () => {
            const result = await refreshWebAnalytics(docsUrl, dateRange);
            if (!result.success) {
                throw new Error(result.error || "Failed to refresh analytics");
            }
        },
        onSuccess: async () => {
            invalidateCache(docsUrl);
            toast.success("Analytics refreshed successfully");
        },
        onError: (error) => {
            console.error("Failed to refresh analytics", error);
            const message = error instanceof Error ? error.message : "Failed to refresh analytics";
            toast.error(message);
        }
    });

    // Check if current date range is cacheable (standard period)
    const isCacheablePeriod =
        dateRange.type === "last_n_days" && [7, 14, 30, 90, 180].includes(dateRange.days as number);

    return (
        <div className="flex w-full flex-col gap-4">
            <div className="flex items-center gap-2">
                <SelectDate value={dateRange} onChange={setDateRange} />
                <Button
                    variant="outline"
                    size="default"
                    onClick={() => refreshMutation.mutate()}
                    disabled={refreshMutation.isPending || !isCacheablePeriod}
                    title={
                        !isCacheablePeriod
                            ? "Refresh only available for standard periods (7, 14, 30, 90, 180 days)"
                            : "Refresh analytics from PostHog"
                    }
                    className="border-border shadow-xs dark:border-border dark:hover:bg-input/50 gap-2 bg-white px-3 py-1.5 text-sm dark:bg-transparent"
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
                orgName={orgName}
                gitUrl={githubUrl}
                baseBranch={baseBranch}
            />
        </div>
    );
}

export default function WebAnalyticsPage({ docsUrl }: WebAnalyticsPageProps) {
    const [dateRange, setDateRange] = useState<DateRangeOptions>({
        type: "last_n_days",
        days: 7
    });
    const [groupBy, setGroupBy] = useState<number | undefined>(undefined);

    return (
        <AnalyticsDataProvider docsUrl={docsUrl} dateRange={dateRange} groupBy={groupBy}>
            <WebAnalyticsContent
                docsUrl={docsUrl}
                dateRange={dateRange}
                setDateRange={setDateRange}
                groupBy={groupBy}
                setGroupBy={setGroupBy}
            />
        </AnalyticsDataProvider>
    );
}
