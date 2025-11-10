import type { FacetFilter, FacetsResponse } from "@fern-docs/search-keyword";
import { useAtom } from "jotai";
import { type atomWithDefault, RESET } from "jotai/utils";
import type React from "react";
import { createContext, useMemo } from "react";

import { filtersAtom } from "./FilterProvider";

export const FacetFiltersContext = createContext({
    preloadFacets: (_: readonly FacetFilter[]): Promise<FacetsResponse> => Promise.resolve({}),
    fetchFacets: (_: readonly string[]): Promise<FacetsResponse> => Promise.resolve({})
});

/**
 * A generic interface for managing facet filters state and actions.
 */
export interface FacetFiltersManager<T = readonly FacetFilter[]> {
    filters: T;
    setFilters: React.Dispatch<React.SetStateAction<T>>;
    clearFilters: () => void;
    resetFilters: () => void;
    popFilter: () => void;
    handlePopState: React.KeyboardEventHandler<HTMLElement>;
}

/**
 * useFacetFilters - returns the facet filters manager for Algolia or Meilisearch.
 */
export function useFacetFilters(
    atom?: ReturnType<typeof atomWithDefault<readonly FacetFilter[]>>
): FacetFiltersManager {
    const [filters, setFilters] = useAtom(atom ?? filtersAtom);

    return useMemo(() => {
        const clearFilters = () => setFilters([]);
        const resetFilters = () => setFilters(RESET);
        const popFilter = () => setFilters((prev) => prev.slice(0, -1));
        return {
            filters,
            setFilters,
            clearFilters,
            resetFilters,
            popFilter,
            handlePopState: (e) => {
                if (e.metaKey || e.ctrlKey) {
                    clearFilters();
                } else {
                    popFilter();
                }
            }
        };
    }, [filters, setFilters]);
}
