import type { FacetFilter } from "@fern-docs/search-keyword";
import type { FacetFilters } from "algoliasearch/lite";

export function toAlgoliaFacetFilters(filters: readonly FacetFilter[]): string[] {
    return filters.map((filter) => `${filter.facet}:${filter.value}`) satisfies FacetFilters;
}
