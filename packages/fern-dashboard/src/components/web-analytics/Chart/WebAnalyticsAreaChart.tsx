"use client";

import dayjs from "dayjs";
import { Loader2 } from "lucide-react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

interface WebAnalyticsAreaChartProps {
    data: { date: string; value: number }[] | undefined;
    isLoading: boolean;
    error: Error | null;
    metric?: "pageviews" | "visitors";
    groupBy?: number;
}

export default function WebAnalyticsAreaChart({
    data,
    isLoading,
    error,
    metric = "pageviews",
    groupBy = 1
}: WebAnalyticsAreaChartProps) {
    if (isLoading) {
        return (
            <div className="flex h-[300px] w-full items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin" />
            </div>
        );
    }

    if (error || !data) {
        return (
            <div className="border-border flex h-[300px] items-center justify-center rounded-lg border">
                <p className="text-muted-foreground text-sm">
                    {error ? "Error loading chart data" : "No data available"}
                </p>
            </div>
        );
    }

    // Format data for Recharts based on groupBy
    const chartData = data.map((item) => {
        const date = dayjs(item.date);

        let displayDate: string;
        let fullDate: string;

        if (groupBy === 7) {
            // Weekly format: "2-6 Sep"
            const today = dayjs();
            const endOfWeek = date.add(6, "day");
            // Don't show future dates - cap at today
            const endDate = endOfWeek.isAfter(today) ? today : endOfWeek;

            // Format based on whether dates are in same month
            if (date.month() === endDate.month()) {
                displayDate = `${date.format("D")}-${endDate.format("D")} ${date.format("MMM")}`;
            } else {
                displayDate = `${date.format("MMM D")} - ${endDate.format("MMM D")}`;
            }
            fullDate = `${date.format("MMM D")} - ${endDate.format("MMM D")}`;
        } else if (groupBy === 30) {
            // Monthly format: "Mar 2025"
            displayDate = date.format("MMM YYYY");
            fullDate = date.format("MMMM YYYY");
        } else {
            // Daily format: "Sep 2"
            displayDate = date.format("MMM D");
            fullDate = date.format("ddd, MMM D");
        }

        return {
            ...item,
            displayDate,
            fullDate
        };
    });

    // Custom tooltip matching dashboard theme
    const CustomTooltip = ({ active, payload }: any) => {
        if (active && payload?.[0]) {
            const metricLabel = metric === "visitors" ? "Visitors" : "Views";
            return (
                <div className="shadow-card-grayscale rounded-lg border-none bg-[var(--gray-1200)] p-2 text-left text-sm leading-normal text-[var(--gray-100)]">
                    <div className="pb-1">
                        <div className="font-medium">{payload[0].payload.fullDate}</div>
                    </div>
                    <div className="flex items-center justify-between gap-4 pt-2">
                        <div className="flex items-center gap-2">
                            <span className="h-2 w-2 rounded-full bg-[var(--primary)]" />
                            <span className="text-[var(--gray-400)]">{metricLabel}:</span>
                        </div>
                        <span className="font-medium">{new Intl.NumberFormat("en-US").format(payload[0].value)}</span>
                    </div>
                </div>
            );
        }
        return null;
    };

    return (
        <div className="mt-6 h-[300px] w-full" style={{ marginLeft: "-24px" }}>
            <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 0, left: 0, bottom: 0 }}>
                    <defs>
                        <linearGradient id="colorPageViews" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                        </linearGradient>
                    </defs>
                    <CartesianGrid
                        strokeDasharray="3 3"
                        vertical={false}
                        stroke="#e5e7eb"
                        className="dark:opacity-20"
                    />
                    <XAxis
                        dataKey="displayDate"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 12, fill: "#6b7280" }}
                        dy={10}
                    />
                    <YAxis
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 12, fill: "#6b7280" }}
                        tickFormatter={(value) => {
                            if (value >= 1000) {
                                return `${(value / 1000).toFixed(1)}k`;
                            }
                            return value;
                        }}
                    />
                    <Tooltip content={<CustomTooltip />} cursor={false} />
                    <Area
                        type="linear"
                        dataKey="value"
                        stroke="#10b981"
                        strokeWidth={2}
                        fillOpacity={1}
                        fill="url(#colorPageViews)"
                        dot={false}
                        activeDot={{
                            r: 6,
                            fill: "#10b981",
                            strokeWidth: 2,
                            stroke: "#fff"
                        }}
                    />
                </AreaChart>
            </ResponsiveContainer>
        </div>
    );
}
