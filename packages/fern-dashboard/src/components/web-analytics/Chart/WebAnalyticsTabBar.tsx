"use client";

import { Eye, User } from "lucide-react";

import { AnalyticsHistogramTabItem } from "@/components/analytics/AnalyticsHistogramTabItem";

type ChartMetric = "pageviews" | "visitors";

interface WebAnalyticsTabBarProps {
    selectedMetric: ChartMetric;
    onChangeMetric: (metric: ChartMetric) => void;
}

export function WebAnalyticsTabBar({ selectedMetric, onChangeMetric }: WebAnalyticsTabBarProps) {
    return (
        <div className="flex min-w-0">
            <AnalyticsHistogramTabItem
                title="Page views"
                icon={<Eye className="h-4 w-4" />}
                isSelected={selectedMetric === "pageviews"}
                onClick={() => {
                    onChangeMetric("pageviews");
                }}
            />
            <AnalyticsHistogramTabItem
                title="Visitors"
                icon={<User className="h-4 w-4" />}
                isSelected={selectedMetric === "visitors"}
                onClick={() => {
                    onChangeMetric("visitors");
                }}
            />
        </div>
    );
}
