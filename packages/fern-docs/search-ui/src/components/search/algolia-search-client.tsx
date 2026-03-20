"use client";

import { getDevice, getPlatform } from "@fern-api/ui-core-utils";
import type { FacetFilter, FacetName, FacetsResponse } from "@fern-docs/search-keyword";
import { useLazyRef } from "@fern-ui/react-commons";
import type { LegacySearchMethodProps, SearchMethodParams } from "algoliasearch/lite";
import { type LiteClient, liteClient } from "algoliasearch/lite";
import { uniq } from "es-toolkit/array";
import { createContext, type PropsWithChildren, type ReactNode, useContext, useEffect, useMemo, useRef } from "react";
import { Configure } from "react-instantsearch";
import { InstantSearchNext } from "react-instantsearch-nextjs";
import useSWRImmutable from "swr/immutable";

import { toAlgoliaFacetFilters } from "../../utils/facet-filters";
import { FacetFiltersProvider } from "./FacetFiltersProvider";
import { FacetFiltersContext, useFacetFilters } from "./useFacetFilters";

/**
 * Checks if all search requests have empty queries and no facet filters.
 * Handles both modern SearchMethodParams and legacy array format.
 * Returns false (i.e. should NOT skip) when facet filters are present,
 * so that filter-only searches still hit Algolia.
 */
function shouldSkipSearch(params: SearchMethodParams | LegacySearchMethodProps): boolean {
    const requests = Array.isArray(params) ? params : params.requests;
    return requests.every((req) => {
        const query = (req as { query?: string }).query ?? (req as { params?: { query?: string } }).params?.query ?? "";
        const facetFilters =
            (req as { facetFilters?: unknown }).facetFilters ??
            (req as { params?: { facetFilters?: unknown } }).params?.facetFilters;
        const hasFilters = Array.isArray(facetFilters) ? facetFilters.length > 0 : facetFilters != null;
        return query.trim().length === 0 && !hasFilters;
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
 * Wraps an Algolia client to skip empty query requests when the search dialog is closed.
 * This prevents unnecessary network calls on initial mount when InstantSearch
 * sends an empty query to "warm up" the connection.
 * When the dialog is open, empty queries are allowed through so initial results appear.
 *
 * @see https://www.algolia.com/doc/guides/building-search-ui/going-further/conditional-requests/react/
 */
function createSearchClientProxy(client: LiteClient, isDialogOpen: { current: boolean }): LiteClient {
    return {
        ...client,
        search: (searchMethodParams, requestOptions) => {
            if (!isDialogOpen.current && shouldSkipSearch(searchMethodParams)) {
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
    optionalFilters,
    dialogOpen,
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
    /**
     * Optional filters to boost results matching certain criteria (e.g. current product/version)
     * without excluding non-matching results. This influences Algolia's ranking so that
     * the first page of results already prioritizes matching items.
     */
    optionalFilters?: string[];
    /**
     * Whether the search dialog is currently open. When true, empty queries are
     * allowed through to Algolia so initial results appear on modal open.
     */
    dialogOpen?: boolean;
}>): ReactNode {
    return (
        <SearchClientProvider {...props} dialogOpen={dialogOpen}>
            <FacetFiltersProvider fetchFacets={fetchFacets} initialFilters={initialFilters}>
                <AlgoliaInstantSearchWrapper
                    authenticatedUserToken={authenticatedUserToken}
                    analyticsTags={uniq([getPlatform(), getDevice(), props.domain, ...(analyticsTags ?? [])])}
                    optionalFilters={optionalFilters}
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
    indexName,
    dialogOpen
}: {
    children: ReactNode;
    appId: string;
    apiKey: string;
    domain: string;
    indexName: string;
    dialogOpen?: boolean;
}): ReactNode {
    // FIX: Dialog-aware request gating to show initial results without background fetches.
    // InstantSearch is always mounted (even before the modal opens) and sends an empty
    // query on mount. Without this gate, every page load would trigger an Algolia request.
    // The ref is read by the proxy at request time: when closed, empty queries return an
    // empty response locally; when open, they pass through so users see initial results.
    // Algolia's built-in response caching handles subsequent opens without extra requests.
    const dialogOpenRef = useRef(false);
    dialogOpenRef.current = dialogOpen ?? false;
    const client = useLazyRef(() => liteClient(appId, apiKey));
    const proxyClient = useLazyRef(() => createSearchClientProxy(client.current, dialogOpenRef));

    useEffect(() => {
        client.current.setClientApiKey({ apiKey });
    }, [apiKey]);

    const value = useMemo(
        () => ({ searchClient: proxyClient.current, apiKey, domain, indexName }),
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
    analyticsTags,
    optionalFilters
}: PropsWithChildren<{
    authenticatedUserToken?: string;
    analyticsTags?: string[];
    optionalFilters?: string[];
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
        >
            <Configure
                attributesToSnippet={["description:32", "content:32"]}
                facetFilters={toAlgoliaFacetFilters(filters)}
                optionalFilters={optionalFilters}
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
