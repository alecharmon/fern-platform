"use client";

import { FernFai } from "@fern-api/fai-sdk";

import { cn } from "@/utils/utils";

import { AnalyticsHistogramChart } from "./AnalyticsHistogramChart";
import { AnalyticsHistogramTabBar } from "./AnalyticsHistogramTabBar";
import { BORDER_STYLES, RenderType } from "./AnalyticsPageClient";
import { TimeRangeOption, TimeRangeSelect } from "./TimeRangeSelect";
import { TimeRange } from "./utils/get-request-params";
import { parseLabel } from "./utils/parse-label";

const ANALYTICS_TIME_RANGE_OPTIONS: TimeRangeOption[] = [
  { label: "Last Week", value: TimeRange.LAST_WEEK },
  { label: "Last Month", value: TimeRange.LAST_MONTH },
  { label: "Last Year", value: TimeRange.LAST_YEAR },
];

export function AnalyticsHistogram({
  renderType,
  setRenderType,
  histogramTimeRange,
  setHistogramTimeRange,
  histogramData,
}: {
  renderType: RenderType;
  setRenderType: (type: RenderType) => void;
  histogramTimeRange: TimeRange;
  setHistogramTimeRange: (range: TimeRange) => void;
  histogramData: FernFai.HistogramAnalytics;
}) {
  const chartData = histogramData.bars.map((bar) => ({
    displayLabel: parseLabel(bar.label),
    count: renderType === "QUERIES" ? bar.queryCount : bar.conversationCount,
  }));

  return (
    <div className={cn(BORDER_STYLES, "border-gray-0 w-full border")}>
      <div className="mb-4 flex w-full flex-wrap justify-between gap-4">
        <AnalyticsHistogramTabBar
          renderType={renderType}
          onChangeRenderType={setRenderType}
        />
        <TimeRangeSelect
          value={histogramTimeRange}
          onChange={setHistogramTimeRange}
          options={ANALYTICS_TIME_RANGE_OPTIONS}
        />
      </div>
      <div className="w-full overflow-x-auto">
        <AnalyticsHistogramChart
          chartData={chartData}
          renderType={renderType}
        />
      </div>
    </div>
  );
}
