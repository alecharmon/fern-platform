"use client";

import { useMemo } from "react";

import { useAnalyticsData } from "../AnalyticsDataContext";
import { ANALYTICS_COLUMNS, ANALYTICS_FIELDS, ANALYTICS_SORT_DIR } from "../constants";
import { useAnalyticsTable } from "../hooks/useAnalyticsTable";
import AnalyticsMiniTable from "./AnalyticsMiniTable";

export default function ReferringDomainsTable() {
    const { data, isLoading, error } = useAnalyticsData();
    const { sortState, handleSort } = useAnalyticsTable();

    const sortedReferringDomains = useMemo(() => {
        if (!data?.referringDomains) {
            return undefined;
        }
        const domains = [...data.referringDomains];
        if (sortState.field === ANALYTICS_FIELDS.VISITORS) {
            domains.sort((a, b) =>
                sortState.order === ANALYTICS_SORT_DIR.DESC ? b.visitors - a.visitors : a.visitors - b.visitors
            );
        } else if (sortState.field === ANALYTICS_FIELDS.VIEWS) {
            domains.sort((a, b) =>
                sortState.order === ANALYTICS_SORT_DIR.DESC ? b.views - a.views : a.views - b.views
            );
        }
        return domains;
    }, [data?.referringDomains, sortState]);

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
                        {/** biome-ignore lint/performance/noImgElement: false positive */}
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
            data={sortedReferringDomains}
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
