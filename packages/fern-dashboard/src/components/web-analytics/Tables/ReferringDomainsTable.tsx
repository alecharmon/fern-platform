"use client";

import { useQuery } from "@tanstack/react-query";

import type { TableRequest } from "@/app/actions/getWebAnalytics";
import { getReferringDomains } from "@/app/actions/getWebAnalytics";

import { ANALYTICS_COLUMNS, ANALYTICS_FIELDS } from "../constants";
import { useAnalyticsTable } from "../hooks/useAnalyticsTable";
import AnalyticsMiniTable from "./AnalyticsMiniTable";

interface ReferringDomainsTableProps {
    docsUrl: string;
    dateRange?: TableRequest["dateRange"];
    includeInternal?: boolean;
}

export default function ReferringDomainsTable({ docsUrl, dateRange, includeInternal }: ReferringDomainsTableProps) {
    const { sortState, handleSort } = useAnalyticsTable();

    const { data, isLoading, error } = useQuery({
        queryKey: ["referringDomains", docsUrl, dateRange, includeInternal, sortState],
        queryFn: () =>
            getReferringDomains({
                docsUrl,
                dateRange,
                includeInternal,
                orderBy: sortState.field,
                order: sortState.order,
                limit: 10
            }),
        staleTime: 1000 * 60 * 5, // 5 minutes
        refetchOnWindowFocus: false
    });

    const filteredData = data?.referringDomains ?? [];

    const columns = [
        {
            key: "domain",
            label: "",
            width: "auto",
            render: (item: { domain: string }) => {
                // Add favicon for popular domains
                const getFavicon = (domain: string) => {
                    // Clean up the domain for favicon service
                    const cleanDomain = domain.replace(/^www\./, "");
                    return `https://img.logo.dev/${cleanDomain}?token=pk_MfP7SQKCTlCwTTPKVeUw8Q&retina=true`;
                };

                return (
                    <span className="flex items-center gap-2">
                        <img
                            src={getFavicon(item.domain)}
                            alt=""
                            className="h-4 w-4 rounded-full"
                            onError={(e) => {
                                // Hide image if favicon fails to load
                                (e.target as HTMLImageElement).style.display = "none";
                            }}
                        />
                        {item.domain}
                    </span>
                );
            }
        },
        ANALYTICS_COLUMNS.visitors,
        ANALYTICS_COLUMNS.views
    ];

    return (
        <AnalyticsMiniTable
            title="Referring Domains"
            data={filteredData}
            isLoading={isLoading}
            error={error}
            columns={columns}
            getItemKey={(item) => item.domain}
            showGradient={true}
            gradientKey={sortState.field}
            onSort={handleSort}
            maxLength={45}
            defaultSortField={ANALYTICS_FIELDS.VISITORS}
        />
    );
}
