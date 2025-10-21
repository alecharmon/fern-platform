"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import {
    getSearchesWithNoResults,
    getTopSearches,
    type SearchWithNoResults,
    type TopSearch
} from "@/app/actions/getAlgoliaAnalytics";
import type { DateRangeOptions } from "@/app/services/algolia-analytics/types";

import AnalyticsMiniTable from "../../web-analytics/Tables/AnalyticsMiniTable";

interface SearchAnalyticsTablesProps {
    dateRange: DateRangeOptions;
    domain: string;
}

const formatNumber = (value: number) => new Intl.NumberFormat("en-US").format(value);

const MAX_TABLE_LIMIT = 10;

const filterTableData = (data: TopSearch[] | SearchWithNoResults[]) => {
    return data.filter((item) => !!item.search).slice(0, MAX_TABLE_LIMIT);
};
function SearchAnalyticsTables({ dateRange, domain }: SearchAnalyticsTablesProps) {
    // Track sorting state for both tables
    const [topSearchesSortState, setTopSearchesSortState] = useState<{
        field: string;
        order: "asc" | "desc";
    }>({
        field: "count",
        order: "desc"
    });

    const [noResultsSortState, setNoResultsSortState] = useState<{
        field: string;
        order: "asc" | "desc";
    }>({
        field: "count",
        order: "desc"
    });

    // Fetch top searches data
    const topSearchesQuery = useQuery({
        queryKey: ["top-searches", dateRange, topSearchesSortState, domain],
        queryFn: () =>
            getTopSearches({
                dateRange,
                limit: 50,
                tags: domain
            }),
        refetchInterval: 60000
    });

    // Fetch searches with no results data
    const noResultsQuery = useQuery({
        queryKey: ["no-results-searches", dateRange, noResultsSortState, domain],
        queryFn: () =>
            getSearchesWithNoResults({
                dateRange,
                limit: 50,
                tags: domain
            }),
        refetchInterval: 60000
    });

    const filteredTopSearches = filterTableData(topSearchesQuery.data?.searches ?? []);
    const filteredNoResults = filterTableData(noResultsQuery.data?.searches ?? []);

    return (
        <div className="flex flex-col gap-4">
            {/* First row: Top Searches and Searches with No Results */}
            <div className="flex flex-col gap-4 lg:flex-row">
                <AnalyticsMiniTable
                    defaultSortField="count"
                    title="Top searches"
                    data={filteredTopSearches}
                    isLoading={topSearchesQuery.isLoading}
                    error={topSearchesQuery.error}
                    columns={[
                        { key: "search", label: "Query" },
                        {
                            key: "count",
                            label: "Count",
                            sortable: true,
                            format: formatNumber,
                            width: "100px"
                        }
                    ]}
                    getItemKey={(item) => item.search}
                    showGradient={true}
                    gradientKey={topSearchesSortState.field}
                    barVariant="green"
                    onSort={(field, direction) => {
                        if (field === "count" || field === "percentage") {
                            setTopSearchesSortState({ field, order: direction });
                        }
                    }}
                />

                <AnalyticsMiniTable
                    defaultSortField="count"
                    title="Searches with no results"
                    data={filteredNoResults}
                    isLoading={noResultsQuery.isLoading}
                    error={noResultsQuery.error}
                    columns={[
                        { key: "search", label: "Query" },
                        {
                            key: "count",
                            label: "Count",
                            sortable: true,
                            format: formatNumber,
                            width: "100px"
                        }
                    ]}
                    getItemKey={(item) => item.search}
                    showGradient={true}
                    gradientKey={noResultsSortState.field}
                    barVariant="red"
                    onSort={(field, direction) => {
                        if (field === "count" || field === "percentage") {
                            setNoResultsSortState({ field, order: direction });
                        }
                    }}
                />
            </div>
        </div>
    );
}

export default SearchAnalyticsTables;
