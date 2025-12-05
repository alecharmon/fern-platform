"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { getTopCountries, getTopPages } from "@/app/actions/getWebAnalytics";
import type { Auth0OrgName } from "@/app/services/auth0/types";
import type { DateRangeOptions } from "@/app/services/posthog/types";
import type { DocsUrl } from "@/utils/types";

import { ANALYTICS_FIELDS, ANALYTICS_SORT_DIR, type AnalyticsSortState } from "../constants";
import { getCountryFlag, getCountryName } from "../constants/countries";
import AnalyticsMiniTable from "./AnalyticsMiniTable";
import APIExplorerRequestsTable from "./APIExplorerRequestsTable";
import ChannelsTable from "./ChannelsTable";
import DeviceTypesTable from "./DeviceTypesTable";
import LLMBotProvidersTable from "./LLMBotProvidersTable";
import LLMFileViewsTable from "./LLMFileViewsTable";
import NotFoundPagesTable from "./NotFoundPagesTable";
import ReferringDomainsTable from "./ReferringDomainsTable";

interface AnalyticsTablesProps {
    docsUrl: DocsUrl;
    dateRange: DateRangeOptions;
    orgName?: Auth0OrgName;
    gitUrl?: string;
    baseBranch?: string;
}

const formatNumber = (value: number) => new Intl.NumberFormat("en-US").format(value);

function AnalyticsTables({ docsUrl, dateRange, orgName, gitUrl, baseBranch }: AnalyticsTablesProps) {
    // Track sorting state for both tables
    const [pagesSortState, setPagesSortState] = useState<AnalyticsSortState>({
        field: ANALYTICS_FIELDS.VISITORS,
        order: ANALYTICS_SORT_DIR.DESC
    });

    const [countriesSortState, setCountriesSortState] = useState<AnalyticsSortState>({
        field: ANALYTICS_FIELDS.VISITORS,
        order: ANALYTICS_SORT_DIR.DESC
    });

    // Fetch top pages data
    const pagesQuery = useQuery({
        queryKey: ["top-pages", docsUrl, dateRange, pagesSortState],
        queryFn: () =>
            getTopPages({
                docsUrl,
                dateRange,
                limit: 10,
                orderBy: pagesSortState.field,
                order: pagesSortState.order
            }),
        refetchInterval: 60000
    });

    // Fetch top countries data
    const countriesQuery = useQuery({
        queryKey: ["top-countries", docsUrl, dateRange, countriesSortState],
        queryFn: () =>
            getTopCountries({
                docsUrl,
                dateRange,
                limit: 10,
                orderBy: countriesSortState.field,
                order: countriesSortState.order
            }),
        refetchInterval: 60000
    });

    return (
        <div className="flex flex-col gap-4">
            {/* First row: Paths and Countries */}
            <div className="flex flex-col gap-4 lg:flex-row">
                <AnalyticsMiniTable
                    defaultSortField={ANALYTICS_FIELDS.VISITORS}
                    title="Paths"
                    data={pagesQuery.data?.topPages}
                    isLoading={pagesQuery.isLoading}
                    error={pagesQuery.error}
                    columns={[
                        { key: ANALYTICS_FIELDS.PATH, label: "Path" },
                        {
                            key: ANALYTICS_FIELDS.VISITORS,
                            label: "Visitors",
                            sortable: true,
                            format: formatNumber
                        },
                        {
                            key: ANALYTICS_FIELDS.VIEWS,
                            label: "Views",
                            sortable: true,
                            format: formatNumber
                        }
                    ]}
                    getItemKey={(item) => item.path}
                    showGradient={true}
                    gradientKey={pagesSortState.field}
                    onSort={(field, direction) => {
                        if (field === ANALYTICS_FIELDS.VISITORS || field === ANALYTICS_FIELDS.VIEWS) {
                            setPagesSortState({ field, order: direction });
                        }
                    }}
                />

                <AnalyticsMiniTable
                    defaultSortField={ANALYTICS_FIELDS.VISITORS}
                    title="Countries"
                    data={countriesQuery.data?.topCountries}
                    isLoading={countriesQuery.isLoading}
                    error={countriesQuery.error}
                    columns={[
                        {
                            key: "country",
                            label: "Country",
                            render: (item) => {
                                const flag = getCountryFlag(item.country);
                                const name = getCountryName(item.country);
                                return flag ? `${flag}  ${name}` : name;
                            }
                        },
                        {
                            key: ANALYTICS_FIELDS.VISITORS,
                            label: "Visitors",
                            sortable: true,
                            format: formatNumber
                        },
                        {
                            key: ANALYTICS_FIELDS.VIEWS,
                            label: "Views",
                            sortable: true,
                            format: formatNumber
                        }
                    ]}
                    getItemKey={(item) => item.country}
                    showGradient={true}
                    gradientKey={countriesSortState.field}
                    onSort={(field, direction) => {
                        if (field === ANALYTICS_FIELDS.VISITORS || field === ANALYTICS_FIELDS.VIEWS) {
                            setCountriesSortState({ field, order: direction });
                        }
                    }}
                />
            </div>

            {/* Second row: Channels and Device Types */}
            <div className="flex flex-col gap-4 lg:flex-row">
                <ChannelsTable docsUrl={docsUrl} dateRange={dateRange} />
                <DeviceTypesTable docsUrl={docsUrl} dateRange={dateRange} />
            </div>

            {/* Third row: Referring Domains and LLM File Views */}
            <div className="flex flex-col gap-4 lg:flex-row">
                <ReferringDomainsTable docsUrl={docsUrl} dateRange={dateRange} />
                <LLMFileViewsTable docsUrl={docsUrl} dateRange={dateRange} />
            </div>

            {/* Fourth row: 404 Pages */}
            <div className="flex flex-col gap-4 lg:flex-row">
                <NotFoundPagesTable
                    docsUrl={docsUrl}
                    dateRange={dateRange}
                    orgName={orgName}
                    gitUrl={gitUrl}
                    baseBranch={baseBranch}
                />
            </div>

            {/* Fifth row: API Explorer Requests and LLM Bot Traffic */}
            <div className="flex flex-col gap-4 lg:flex-row">
                <APIExplorerRequestsTable docsUrl={docsUrl} dateRange={dateRange} />
                <LLMBotProvidersTable docsUrl={docsUrl} dateRange={dateRange} />
            </div>
        </div>
    );
}

export default AnalyticsTables;
