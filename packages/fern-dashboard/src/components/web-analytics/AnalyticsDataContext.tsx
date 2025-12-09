"use client";

import { useQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { createContext, useContext } from "react";

import type { AllAnalyticsResponse, GetWebAnalyticsRequest } from "@/app/actions/getWebAnalytics";

import { ANALYTICS_STALE_TIME, getAllAnalytics } from "./api";

interface AnalyticsDataContextValue {
    data: AllAnalyticsResponse | undefined;
    isLoading: boolean;
    error: Error | null;
}

const AnalyticsDataContext = createContext<AnalyticsDataContextValue | undefined>(undefined);

interface AnalyticsDataProviderProps {
    children: ReactNode;
    docsUrl: string;
    dateRange: GetWebAnalyticsRequest["dateRange"];
    groupBy?: number | undefined;
}

export function AnalyticsDataProvider({ children, docsUrl, dateRange, groupBy }: AnalyticsDataProviderProps) {
    const { data, isLoading, error } = useQuery({
        queryKey: ["all-analytics", docsUrl, dateRange, groupBy],
        queryFn: () => getAllAnalytics({ docsUrl, dateRange, groupBy }),
        staleTime: ANALYTICS_STALE_TIME
    });

    return (
        <AnalyticsDataContext.Provider value={{ data, isLoading, error: error as Error | null }}>
            {children}
        </AnalyticsDataContext.Provider>
    );
}

export function useAnalyticsData() {
    const context = useContext(AnalyticsDataContext);
    if (context === undefined) {
        throw new Error("useAnalyticsData must be used within AnalyticsDataProvider");
    }
    return context;
}
