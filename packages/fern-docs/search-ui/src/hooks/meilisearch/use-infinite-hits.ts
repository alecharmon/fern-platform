import type { SendEventForHits } from "instantsearch.js/es/lib/utils";
import { useCallback, useEffect, useRef, useState } from "react";
import type { useInfiniteHits } from "react-instantsearch";

import { useMeiliSearchClient } from "../../components/search/meili-search-client";
import { useFacetFilters } from "../../components/search/useFacetFilters";
import { useSearchBox } from "../../components/search/useSearchBox";
import type { AlgoliaRecord, AlgoliaRecordHit, FacetFilter } from "../../types";

function useSearchQuery(): string {
    const { query } = useSearchBox();
    return query;
}

interface MeilisearchHit {
    _formatted?: Record<string, any>;
    _matchesPosition?: Record<string, any>;
    _highlightResult?: Record<string, any>;
    _snippetResult?: Record<string, any>;
    __position?: number;
    objectID: string;
    [key: string]: any;
}

interface _MeilisearchResponse {
    hits: MeilisearchHit[];
    query: string;
    processingTimeMs: number;
    limit: number;
    offset: number;
    estimatedTotalHits: number;
    totalHits?: number;
    totalPages?: number;
    hitsPerPage?: number;
    page?: number;
    facetDistribution?: Record<string, Record<string, number>>;
    facetStats?: Record<string, any>;
}

const HITS_PER_PAGE = 20;

export function useMeilisearchInfiniteHits(): ReturnType<typeof useInfiniteHits<AlgoliaRecord>> {
    const [allHits, setAllHits] = useState<AlgoliaRecordHit[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [currentPage, setCurrentPage] = useState(0);
    const [_totalHits, setTotalHits] = useState(0);
    const [hasMore, setHasMore] = useState(true);
    const [results, setResults] = useState<any>();

    const query = useSearchQuery();

    const { filters } = useFacetFilters();

    // Prevent infinite requests by tracking last query/filters
    const lastQueryRef = useRef<string | undefined>(undefined);
    const lastFiltersRef = useRef<string | undefined>(undefined);

    // MeiliSearch client is recreated on every render, but that's fine for now
    const { searchClient: client } = useMeiliSearchClient();

    // Helper to build MeiliSearch filter string
    function buildFilterString(filters: readonly FacetFilter[]): string | undefined {
        // FacetFilter[] is an array of { facet: string, value: string }
        // We want to build a Meilisearch filter string like: 'facet = "value"'
        if (!filters || filters.length === 0) {
            return undefined;
        }
        const filterClauses: string[] = [];
        for (const filter of filters) {
            const { facet, value } = filter;
            if (value !== undefined && value != null && value !== "") {
                filterClauses.push(`${facet} = "${value}"`);
            }
        }
        if (filterClauses.length === 0) {
            return undefined;
        }
        return filterClauses.join(" AND ");
    }

    // Reset state when query or filters change
    useEffect(() => {
        // Only reset if query/filters actually changed
        const filtersString = JSON.stringify(filters);
        if (lastQueryRef.current !== query || lastFiltersRef.current !== filtersString) {
            // Don't clear hits when firing off a new search
            // setAllHits([]); // <-- removed per instruction
            setCurrentPage(0);
            setTotalHits(0);
            setHasMore(true);
            setResults(undefined);
            lastQueryRef.current = query;
            lastFiltersRef.current = filtersString;
        }
    }, [query, filters]);

    // Fetch hits from Meilisearch, distinct on api_endpoint_page
    const fetchHits = useCallback(
        async (page: number, append: boolean = false) => {
            if (isLoading) {
                return;
            }
            setIsLoading(true);

            try {
                const index = client.index("docs");

                const filterString = buildFilterString(filters);

                // Only use allowed Meilisearch search parameters
                const searchParams: Record<string, any> = {
                    q: query,
                    limit: HITS_PER_PAGE,
                    offset: page * HITS_PER_PAGE,
                    attributesToHighlight: ["*"],
                    highlightPreTag: "<mark>",
                    highlightPostTag: "</mark>",
                    // Meilisearch: enable distinct on "distinct" field, matching Algolia's distinct
                    // This ensures that only one result per unique "distinct" value is returned
                    distinct: "distinct"
                };
                if (filterString) {
                    searchParams.filter = filterString;
                }

                const response = await index.search<MeilisearchHit>(query, searchParams);

                const newHits = (response.hits || []).map((hit, index) => ({
                    ...hit,
                    __position: page * HITS_PER_PAGE + index,
                    _highlightResult: convertHighlighting(hit._formatted || {}),
                    _snippetResult: convertSnippeting(hit._formatted || {})
                })) as AlgoliaRecordHit[];

                setResults({
                    ...response,
                    index: "meilisearch-index",
                    nbHits: response.estimatedTotalHits,
                    nbPages: Math.ceil(response.estimatedTotalHits / HITS_PER_PAGE),
                    processingTimeMS: response.processingTimeMs,
                    query: response.query,
                    params: "",
                    exhaustiveNbHits: false,
                    exhaustiveFacetsCount: undefined,
                    facets: response.facetDistribution,
                    facets_stats: response.facetStats,
                    page: 0,
                    hitsPerPage: HITS_PER_PAGE,
                    length: response.hits?.length || 0,
                    offset: response.offset,
                    limit: response.limit
                } as any);
                setTotalHits(response.estimatedTotalHits);

                if (append) {
                    setAllHits((prev) => {
                        return [...prev, ...newHits];
                    });
                } else {
                    setAllHits(newHits);
                }

                const totalPages = Math.ceil(response.estimatedTotalHits / HITS_PER_PAGE);
                setHasMore(page + 1 < totalPages);
            } catch (error) {
                console.error("Meilisearch error:", error);
                setHasMore(false);
            } finally {
                setIsLoading(false);
            }
        },
        // Only depend on query/filters stringified, not objects themselves
        // and not on client (which is stable), and not on isLoading (which causes infinite loops)
        [query, JSON.stringify(filters)]
    );

    // Initial fetch and fetch on query/filter changes
    useEffect(() => {
        // Only fetch if query or filters are not empty
        if (query || Object.keys(filters).length > 0) {
            fetchHits(0, false);
        }
    }, [query, JSON.stringify(filters), fetchHits]);

    // Show more function for infinite scroll
    const showMore = useCallback(() => {
        if (!hasMore || isLoading) {
            return;
        }
        const nextPage = currentPage + 1;
        setCurrentPage(nextPage);
        fetchHits(nextPage, true);
    }, [currentPage, hasMore, isLoading, fetchHits]);

    // Show previous function (for going back)
    const showPrevious = useCallback(() => {
        if (currentPage <= 0) {
            return;
        }
        const prevPage = currentPage - 1;
        setCurrentPage(prevPage);
        // Optionally, you could re-fetch up to prevPage, but for now just slice
        // fetchHits(0, false);
    }, [currentPage]);

    // Send event function (no-op for Meilisearch)
    const sendEvent: SendEventForHits = useCallback(() => {
        // Meilisearch doesn't have built-in analytics like Algolia
        // You could implement your own analytics here
    }, []);

    // Bind event function
    const bindEvent = useCallback(() => {
        return "";
    }, []);

    // const totalPages = Math.ceil(totalHits / HITS_PER_PAGE);
    const currentPageHits = allHits.slice(currentPage * HITS_PER_PAGE, (currentPage + 1) * HITS_PER_PAGE);

    // Debug: log state changes
    // useEffect(() => {
    //   console.log("[Meilisearch] State changed", {
    //     allHitsCount: allHits.length,
    //     isLoading,
    //     currentPage,
    //     totalHits,
    //     hasMore,
    //     results,
    //   });
    // }, [allHits, isLoading, currentPage, totalHits, hasMore, results]);

    return {
        hits: allHits,
        items: allHits,
        currentPageHits,
        isLastPage: !hasMore,
        showMore,
        showPrevious,
        isFirstPage: currentPage === 0,
        bindEvent,
        results,
        sendEvent
    };
}

// Helper function to convert Meilisearch highlighting to Algolia format
function convertHighlighting(formatted: Record<string, any>): Record<string, any> {
    const result: Record<string, any> = {};
    for (const [key, value] of Object.entries(formatted)) {
        if (typeof value === "string") {
            result[key] = {
                value: value,
                matchLevel: value.includes("<mark>") ? "full" : "none",
                matchedWords: [], // Could extract matched words from marks
                fullyHighlighted: false
            };
        }
    }
    return result;
}

// Helper function to convert Meilisearch snippets to Algolia format
function convertSnippeting(formatted: Record<string, any>): Record<string, any> {
    const result: Record<string, any> = {};
    for (const [key, value] of Object.entries(formatted)) {
        if (typeof value === "string") {
            result[key] = {
                value: value,
                matchLevel: value.includes("<mark>") ? "full" : "none"
            };
        }
    }
    return result;
}

// Also implement the simpler hooks for completeness
export function useMeilisearchHits(): AlgoliaRecordHit[] {
    const { hits } = useMeilisearchInfiniteHits();
    return hits as AlgoliaRecordHit[];
}

export function useMeilisearchSendEvent(): SendEventForHits {
    return () => {
        // Implement your own analytics tracking here if needed
    };
}
