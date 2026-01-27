"use client";

import { getDevice, getPlatform } from "@fern-api/ui-core-utils";
import type { FacetFilter, FacetName, FacetsResponse } from "@fern-docs/search-keyword";
import { useLazyRef } from "@fern-ui/react-commons";
import type { LegacySearchMethodProps, SearchMethodParams } from "algoliasearch/lite";
import { type LiteClient, liteClient } from "algoliasearch/lite";
import { uniq } from "es-toolkit/array";
import { createContext, type PropsWithChildren, type ReactNode, useContext, useEffect, useMemo } from "react";
import { Configure } from "react-instantsearch";
import { InstantSearchNext } from "react-instantsearch-nextjs";
import useSWRImmutable from "swr/immutable";

import { toAlgoliaFacetFilters } from "../../utils/facet-filters";
import { FacetFiltersProvider } from "./FacetFiltersProvider";
import { FacetFiltersContext, useFacetFilters } from "./useFacetFilters";

/**
 * Checks if all search requests have empty queries.
 * Handles both modern SearchMethodParams and legacy array format.
 */
function allQueriesEmpty(params: SearchMethodParams | LegacySearchMethodProps): boolean {
    const requests = Array.isArray(params) ? params : params.requests;
    return requests.every((req) => {
        // Handle both { query } and { params: { query } } formats
        const query = (req as { query?: string }).query ?? (req as { params?: { query?: string } }).params?.query ?? "";
        return query.trim().length === 0;
    });
}

/**
 * Creates an empty response matching Algolia's expected format.
 * Used to skip unnecessary network requests for empty queries.
 */
function createEmptySearchResponse(params: SearchMethodParams | LegacySearchMethodProps) {
    const requests = Array.isArray(params) ? params : params.requests;
    return {
        results: requests.map(() => ({
            hits: [],
            nbHits: 0,
            nbPages: 0,
            page: 0,
            processingTimeMS: 0,
            hitsPerPage: 0,
            exhaustiveNbHits: false,
            query: "",
            params: ""
        }))
    };
}

/**
 * Wraps an Algolia client to skip empty query requests.
 * This prevents unnecessary network calls on initial mount when InstantSearch
 * sends an empty query to "warm up" the connection.
 *
 * @see https://www.algolia.com/doc/guides/building-search-ui/going-further/conditional-requests/react/
 */
function createSearchClientProxy(client: LiteClient): LiteClient {
    return {
        ...client,
        search: (searchMethodParams, requestOptions) => {
            if (allQueriesEmpty(searchMethodParams)) {
                return Promise.resolve(createEmptySearchResponse(searchMethodParams));
            }
            return client.search(searchMethodParams, requestOptions);
        }
    };
}

function AlgoliaSearchClientRoot({
    children,
    fetchFacets,
    initialFilters,
    authenticatedUserToken,
    analyticsTags,
    ...props
}: PropsWithChildren<{
    /**
     * Algolia App ID
     */
    appId: string;
    /**
     * Algolia API Key
     */
    apiKey: string;
    /**
     * Fern Docs Domain
     */
    domain: string;
    /**
     * Algolia Index Name
     */
    indexName: string;
    /**
     * Initial facet filters
     */
    initialFilters?: Partial<Record<FacetName, string>>;
    /**
     * Function to fetch facets
     */
    fetchFacets: (filters: readonly string[]) => Promise<FacetsResponse>;
    /**
     * Authenticated user token (for algolia insights)
     */
    authenticatedUserToken?: string;
    children: ReactNode;
    /**
     * Additional analytics tags to track metrics for this search client.
     */
    analyticsTags?: string[];
}>): ReactNode {
    return (
        <SearchClientProvider {...props}>
            <FacetFiltersProvider fetchFacets={fetchFacets} initialFilters={initialFilters}>
                <AlgoliaInstantSearchWrapper
                    authenticatedUserToken={authenticatedUserToken}
                    analyticsTags={uniq([getPlatform(), getDevice(), props.domain, ...(analyticsTags ?? [])])}
                >
                    {children}
                </AlgoliaInstantSearchWrapper>
            </FacetFiltersProvider>
        </SearchClientProvider>
    );
}

const SearchClientContext = createContext<
    | {
          searchClient: LiteClient;
          apiKey: string;
          domain: string;
          indexName: string;
      }
    | undefined
>(undefined);

/**
 * Provides the Algolia search client wrapped in a proxy that prevents empty query requests.
 * Refreshes the client cache when the API key changes.
 */
function SearchClientProvider({
    children,
    appId,
    apiKey,
    domain,
    indexName
}: {
    children: ReactNode;
    appId: string;
    apiKey: string;
    domain: string;
    indexName: string;
}): ReactNode {
    const client = useLazyRef(() => liteClient(appId, apiKey));
    const proxyClient = useLazyRef(() => createSearchClientProxy(client.current));

    useEffect(() => {
        client.current.setClientApiKey({ apiKey });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [apiKey]);

    const value = useMemo(
        () => ({ searchClient: proxyClient.current, apiKey, domain, indexName }),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [apiKey, domain, indexName]
    );

    return <SearchClientContext.Provider value={value}>{children}</SearchClientContext.Provider>;
}

function useSearchClient(): {
    searchClient: LiteClient;
    apiKey: string;
    domain: string;
    indexName: string;
} {
    const value = useContext(SearchClientContext);
    if (!value) {
        throw new Error("useSearchClient must be used within a SearchClientRoot");
    }
    return value;
}
/**
 * Returns a function to trigger preloading of facets for the given filters.
 */
function usePreloadFacets(): (filters: readonly FacetFilter[]) => Promise<FacetsResponse> {
    return useContext(FacetFiltersContext).preloadFacets;
}

/**
 * Returns the cached facets for the given filters.
 */
function useFacets(filters: readonly FacetFilter[]): {
    facets: FacetsResponse;
    isLoading: boolean;
} {
    const fetchFacets = useContext(FacetFiltersContext).fetchFacets;
    const res = useSWRImmutable(["facets", ...toAlgoliaFacetFilters(filters)], ([_, ...filters]) =>
        fetchFacets(filters)
    );
    return {
        facets: res.data ?? {},
        isLoading: res.isLoading
    };
}

/**
 * Wraps the InstantSearchNext component
 */
function AlgoliaInstantSearchWrapper({
    authenticatedUserToken,
    children,
    analyticsTags
}: PropsWithChildren<{
    authenticatedUserToken?: string;
    analyticsTags?: string[];
}>) {
    const { searchClient, indexName } = useSearchClient();
    const { filters } = useFacetFilters();

    return (
        <InstantSearchNext
            searchClient={searchClient}
            indexName={indexName}
            insights={authenticatedUserToken ? { insightsInitParams: { authenticatedUserToken } } : undefined}
            // CAUTION: do not turn routing on because it interferes with the nextjs app router.
            // for example, it will restore an old url even though you've navigated to a new page.
            routing={false}
            future={{ preserveSharedStateOnUnmount: false }}
        >
            <Configure
                attributesToSnippet={["description:32", "content:32"]}
                facetFilters={toAlgoliaFacetFilters(filters)}
                maxValuesPerFacet={1000}
                facetingAfterDistinct
                restrictHighlightAndSnippetArrays
                distinct
                ignorePlurals
                enableRules
                decompoundQuery
                analytics
                analyticsTags={analyticsTags}
            />
            {children}
        </InstantSearchNext>
    );
}

export { AlgoliaSearchClientRoot, useFacetFilters, useFacets, usePreloadFacets, useSearchClient };
