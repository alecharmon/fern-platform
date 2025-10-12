"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { getTopCountries, getTopPages } from "@/app/actions/getWebAnalytics";
import type { DateRangeOptions } from "@/app/services/posthog/types";
import { ANALYTICS_FIELDS, ANALYTICS_SORT_DIR, type AnalyticsSortState } from "../constants";
import { getCountryFlag, getCountryName } from "../constants/countries";
import AnalyticsMiniTable from "./AnalyticsMiniTable";
import ChannelsTable from "./ChannelsTable";
import DeviceTypesTable from "./DeviceTypesTable";
import LLMFileViewsTable from "./LLMFileViewsTable";
import ReferringDomainsTable from "./ReferringDomainsTable";

interface AnalyticsTablesProps {
    docsUrl: string;
    dateRange: DateRangeOptions;
}

const formatNumber = (value: number) => new Intl.NumberFormat("en-US").format(value);

function AnalyticsTables({ docsUrl, dateRange }: AnalyticsTablesProps) {
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
        </div>
    );
}

export default AnalyticsTables;
