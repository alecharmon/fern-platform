import type React from "react";
import { useCallback, useMemo, useRef } from "react";

import { preload } from "swr";

import { EMPTY_OBJECT } from "@fern-api/ui-core-utils";
import type { FacetFilter, FacetsResponse } from "@fern-docs/search-keyword";
import type { FacetName } from "@fern-docs/search-keyword";
import { useDeepCompareEffectNoCheck } from "@fern-ui/react-commons";

import { isFacetName } from "../../types";
import { toAlgoliaFacetFilters } from "../../utils/facet-filters";
import { FacetFiltersContext, useFacetFilters } from "./useFacetFilters";

/**
 * Provides a context for facet filters. This should be used within PreloadFacetsProvider.
 */

export function FacetFiltersProvider({
    children,
    initialFilters,
    fetchFacets
}: {
    children: React.ReactNode;
    initialFilters?: Partial<Record<FacetName, string>>;
    fetchFacets: (filters: readonly string[]) => Promise<FacetsResponse>;
}): React.ReactNode {
    const { setFilters } = useFacetFilters();

    const preloadFacets = useCallback(
        (filters: readonly FacetFilter[]) =>
            preload(["facets", ...toAlgoliaFacetFilters(filters)], ([_, ...filters]) => fetchFacets(filters)),
        [fetchFacets]
    );

    // preload facets on initial render so that they're cached before the user runs `cmdk`
    useDeepCompareEffectNoCheck(() => {
        const filters = toFacetFilters(initialFilters);
        void preloadFacets(filters);
        setFilters(filters);
    }, [initialFilters, preloadFacets, setFilters]);

    const value = useMemo(() => ({ preloadFacets, fetchFacets }), [preloadFacets, fetchFacets]);
    return <FacetFiltersContext.Provider value={value}>{children}</FacetFiltersContext.Provider>;
}

/**
 * Converts the given initial filters to facet filters.
 */
export function toFacetFilters(
    initialFilters: Partial<Record<FacetName, string>> = EMPTY_OBJECT
): readonly FacetFilter[] {
    const toRet: FacetFilter[] = [];

    Object.entries(initialFilters).forEach(([facet, value]) => {
        if (isFacetName(facet) && value) {
            toRet.push({ facet, value });
        }
    });

    return toRet;
}
