"use client";

import { useMemo, useState } from "react";

import type { Auth0OrgName } from "@/app/services/auth0/types";
import type { DateRangeOptions } from "@/app/services/posthog/types";
import type { DocsUrl } from "@/utils/types";

import { useAnalyticsData } from "../AnalyticsDataContext";
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
    const { data, isLoading, error } = useAnalyticsData();
    // Track sorting state for both tables
    const [pagesSortState, setPagesSortState] = useState<AnalyticsSortState>({
        field: ANALYTICS_FIELDS.VISITORS,
        order: ANALYTICS_SORT_DIR.DESC
    });

    const [countriesSortState, setCountriesSortState] = useState<AnalyticsSortState>({
        field: ANALYTICS_FIELDS.VISITORS,
        order: ANALYTICS_SORT_DIR.DESC
    });

    const sortedPages = useMemo(() => {
        if (!data?.topPages) {
            return undefined;
        }
        const pages = [...data.topPages];
        if (pagesSortState.field === ANALYTICS_FIELDS.VISITORS) {
            pages.sort((a, b) =>
                pagesSortState.order === ANALYTICS_SORT_DIR.DESC ? b.visitors - a.visitors : a.visitors - b.visitors
            );
        } else {
            pages.sort((a, b) =>
                pagesSortState.order === ANALYTICS_SORT_DIR.DESC ? b.views - a.views : a.views - b.views
            );
        }
        return pages;
    }, [data?.topPages, pagesSortState]);

    const sortedCountries = useMemo(() => {
        if (!data?.topCountries) {
            return undefined;
        }
        const countries = [...data.topCountries];
        if (countriesSortState.field === ANALYTICS_FIELDS.VISITORS) {
            countries.sort((a, b) =>
                countriesSortState.order === ANALYTICS_SORT_DIR.DESC ? b.visitors - a.visitors : a.visitors - b.visitors
            );
        } else {
            countries.sort((a, b) =>
                countriesSortState.order === ANALYTICS_SORT_DIR.DESC ? b.views - a.views : a.views - b.views
            );
        }
        return countries;
    }, [data?.topCountries, countriesSortState]);

    return (
        <div className="flex flex-col gap-4">
            {/* First row: Paths and Countries */}
            <div className="flex flex-col gap-4 lg:flex-row">
                <AnalyticsMiniTable
                    defaultSortField={ANALYTICS_FIELDS.VISITORS}
                    title="Paths"
                    data={sortedPages}
                    isLoading={isLoading}
                    error={error}
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
                    data={sortedCountries}
                    isLoading={isLoading}
                    error={error}
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
                <ChannelsTable />
                <DeviceTypesTable />
            </div>

            {/* Third row: Referring Domains and LLM File Views */}
            <div className="flex flex-col gap-4 lg:flex-row">
                <ReferringDomainsTable />
                <LLMFileViewsTable />
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

            {/* Fifth row: API Explorer Requests */}
            <div className="flex flex-col gap-4 lg:flex-row">
                <APIExplorerRequestsTable />
                <LLMBotProvidersTable />
            </div>
        </div>
    );
}

export default AnalyticsTables;
