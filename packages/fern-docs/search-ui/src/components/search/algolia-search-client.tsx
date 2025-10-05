"use client";

import {
    type PropsWithChildren,
    type ReactNode,
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo
} from "react";
import { Configure } from "react-instantsearch";
import { InstantSearchNext } from "react-instantsearch-nextjs";

import { type LiteClient, liteClient } from "algoliasearch/lite";
import { uniq } from "es-toolkit/array";
import { preload } from "swr";
import useSWRImmutable from "swr/immutable";

import { getDevice, getPlatform } from "@fern-api/ui-core-utils";
import type { FacetName, FacetsResponse } from "@fern-docs/search-keyword";
import type { FacetFilter } from "@fern-docs/search-keyword";
import { useLazyRef } from "@fern-ui/react-commons";

import { toAlgoliaFacetFilters } from "../../utils/facet-filters";
import { FacetFiltersProvider } from "./FacetFiltersProvider";
import { FacetFiltersContext, useFacetFilters } from "./useFacetFilters";

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
 * Provides the algolia search client, and refreshes the client cache when the api key changes.
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

    useEffect(() => {
        client.current.setClientApiKey({ apiKey });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [apiKey]);

    const value = useMemo(
        () => ({ searchClient: client.current, apiKey, domain, indexName }),
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

export { AlgoliaSearchClientRoot, useFacets, usePreloadFacets, useSearchClient };
