import type { FacetFilters } from "algoliasearch/lite";

import type { FacetFilter } from "@fern-docs/search-keyword";

export function toAlgoliaFacetFilters(filters: readonly FacetFilter[]): string[] {
    return filters.map((filter) => `${filter.facet}:${filter.value}`) satisfies FacetFilters;
}
