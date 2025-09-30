import { useState } from "react";

import { useQuery } from "@tanstack/react-query";

import {
  getPageViewsByDay,
  getVisitorsByDay,
} from "@/app/actions/getWebAnalytics";
import { DateRangeOptions } from "@/app/services/posthog/types";

import GroupBySelect from "./GroupBySelect";
import WebAnalyticsAreaChart from "./WebAnalyticsAreaChart";
import { WebAnalyticsTabBar } from "./WebAnalyticsTabBar";

type ChartMetric = "pageviews" | "visitors";

interface Props {
  dateRange: DateRangeOptions;
  docsUrl: string;
  groupBy?: number;
  setGroupBy: (groupBy: number) => void;
}

export default function WebAnalyticsChart({
  dateRange,
  docsUrl,
  groupBy,
  setGroupBy,
}: Props) {
  const [selectedMetric, setSelectedMetric] =
    useState<ChartMetric>("pageviews");

  const pageViews = useQuery({
    queryKey: ["page-views", docsUrl, dateRange, groupBy],
    queryFn: () =>
      getPageViewsByDay({
        docsUrl,
        dateRange,
        groupBy,
      }),
    enabled: selectedMetric === "pageviews",
    refetchInterval: 60000, // Refetch every minute
  });

  const visitors = useQuery({
    queryKey: ["visitors", docsUrl, dateRange, groupBy],
    queryFn: () =>
      getVisitorsByDay({
        docsUrl,
        dateRange,
        groupBy,
      }),
    enabled: selectedMetric === "visitors",
    refetchInterval: 60000, // Refetch every minute
  });

  // Select data based on current metric
  const currentData = selectedMetric === "pageviews" ? pageViews : visitors;

  return (
    <div className="border-border w-full rounded-lg border">
      <div className="flex justify-between p-6 pb-4">
        <WebAnalyticsTabBar
          selectedMetric={selectedMetric}
          onChangeMetric={setSelectedMetric}
        />
        <GroupBySelect value={groupBy ?? 1} onChange={setGroupBy} />
      </div>
      <div className="p-6 pr-0">
        <WebAnalyticsAreaChart
          data={currentData.data?.timeSeries}
          isLoading={currentData.isLoading}
          error={currentData.error}
          metric={selectedMetric}
          groupBy={groupBy}
        />
      </div>
    </div>
  );
}
