import { useState } from "react";

import type { DateRangeOptions } from "@/app/services/posthog/types";

import { useAnalyticsData } from "../AnalyticsDataContext";
import GroupBySelect from "./GroupBySelect";
import WebAnalyticsAreaChart from "./WebAnalyticsAreaChart";
import { WebAnalyticsTabBar } from "./WebAnalyticsTabBar";

type ChartMetric = "pageviews" | "visitors";

interface Props {
    dateRange: DateRangeOptions;
    docsUrl: string;
    groupBy?: number | undefined;
    setGroupBy: (groupBy: number) => void;
}

export default function WebAnalyticsChart({ dateRange, docsUrl, groupBy, setGroupBy }: Props) {
    const [selectedMetric, setSelectedMetric] = useState<ChartMetric>("pageviews");
    const { data, isLoading, error } = useAnalyticsData();

    const timeSeriesData = selectedMetric === "pageviews" ? data?.pageViewsTimeSeries : data?.visitorsTimeSeries;

    return (
        <div className="border-border w-full rounded-lg border">
            <div className="flex justify-between p-6 pb-4">
                <WebAnalyticsTabBar selectedMetric={selectedMetric} onChangeMetric={setSelectedMetric} />
                <GroupBySelect value={groupBy} onChange={setGroupBy} />
            </div>
            <div className="p-6 pr-0">
                <WebAnalyticsAreaChart
                    data={timeSeriesData}
                    isLoading={isLoading}
                    error={error}
                    metric={selectedMetric}
                    groupBy={groupBy}
                />
            </div>
        </div>
    );
}
