"use client";

import { Bar, BarChart, CartesianGrid, Tooltip, XAxis } from "recharts";

import { ChartContainer, ChartTooltipContent } from "@/components/ui/chart";

import { RenderType } from "./AnalyticsPageClient";

interface AnalyticsHistogramProps {
  chartData: {
    displayLabel: string;
    count: number;
  }[];
  renderType: RenderType;
}

const CHART_CONFIG = {
  queries: {
    label: "Queries",
    color: "var(--chart-1)",
  },
};

export function AnalyticsHistogramChart({
  chartData,
  renderType,
}: AnalyticsHistogramProps) {
  return (
    <div
      style={{
        width: "100%",
        height: "320px",
        minWidth: "640px",
        minHeight: "0",
      }}
    >
      <ChartContainer
        config={CHART_CONFIG}
        className="aspect-auto h-full w-full overflow-hidden"
      >
        <BarChart
          data={chartData}
          barSize={40}
          margin={{ top: 20, right: 20, left: 20, bottom: 20 }}
        >
          <defs>
            <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
              <stop
                offset="5%"
                stopColor="var(--green-1100)"
                stopOpacity={0.4}
                className="transition-stop-opacity transition"
              />
              <stop
                offset="95%"
                stopColor="var(--green-1100)"
                stopOpacity={0.1}
                className="transition-stop-opacity transition"
              />
            </linearGradient>

            <linearGradient id="barGradientHover" x1="0" y1="0" x2="0" y2="1">
              <stop
                offset="5%"
                stopColor="var(--green-1100)"
                stopOpacity={1.0}
                className="transition-stop-opacity transition"
              />
              <stop
                offset="95%"
                stopColor="var(--green-1100)"
                stopOpacity={0.5}
                className="transition-stop-opacity transition"
              />
            </linearGradient>
          </defs>

          <CartesianGrid strokeDasharray="4 4" vertical={false} />
          <XAxis
            dataKey="displayLabel"
            stroke="var(--gray-400)"
            tick={{ fill: "var(--gray-400)" }}
            tickFormatter={(value, index) => {
              if (chartData.length > 13) {
                return index % 3 === 0 || index === chartData.length - 1
                  ? value
                  : "";
              }
              return value;
            }}
            interval={0}
          />
          <Tooltip
            content={
              <ChartTooltipContent
                name={renderType === "QUERIES" ? "Queries" : "Conversations"}
                hideLabel
              />
            }
          />
          <Bar
            dataKey="count"
            name={renderType === "QUERIES" ? "Queries" : "Conversations"}
            fill="url(#barGradient)"
            activeBar={{
              fill: "url(#barGradientHover)",
            }}
            radius={[8, 8, 0, 0]}
          />
        </BarChart>
      </ChartContainer>
    </div>
  );
}
