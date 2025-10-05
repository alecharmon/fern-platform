"use client";

import { type PropsWithChildren, type ReactNode, createContext, useContext, useMemo } from "react";

import { MeiliSearch } from "meilisearch";

import type { FacetsResponse } from "@fern-docs/search-keyword";

import { FacetFiltersProvider } from "./FacetFiltersProvider";

type MeiliSearchClientContextType = {
    searchClient: MeiliSearch;
    indexName: string;
};

const MeiliSearchClientContext = createContext<MeiliSearchClientContextType | undefined>(undefined);

type MeiliSearchClientRootProps = PropsWithChildren<{
    host: string;
    apiKey?: string;
    indexName: string;
    /**
     * Function to fetch facets
     */
    fetchFacets: (filters: readonly string[]) => Promise<FacetsResponse>;
    /**
     * Initial facet filters (optional, for future extensibility)
     */
    initialFilters?: Record<string, string>;
}>;

function meiliClient(host: string, apiKey?: string): MeiliSearch {
    return new MeiliSearch({ host, apiKey });
}

function MeiliSearchClientProvider({
    children,
    host,
    apiKey,
    indexName,
    fetchFacets,
    initialFilters
}: MeiliSearchClientRootProps): ReactNode {
    const searchClient = useMemo(() => meiliClient(host, apiKey), [host, apiKey]);
    const value = useMemo(() => ({ searchClient, indexName }), [searchClient, indexName]);
    return (
        <MeiliSearchClientContext.Provider value={value}>
            <FacetFiltersProvider fetchFacets={fetchFacets} initialFilters={initialFilters}>
                {children}
            </FacetFiltersProvider>
        </MeiliSearchClientContext.Provider>
    );
}

function useMeiliSearchClient(): MeiliSearchClientContextType {
    const ctx = useContext(MeiliSearchClientContext);
    if (!ctx) {
        throw new Error("useMeiliSearchClient must be used within a MeiliSearchClientRoot");
    }
    return ctx;
}

export { MeiliSearchClientProvider as MeiliSearchClientRoot, useMeiliSearchClient };
