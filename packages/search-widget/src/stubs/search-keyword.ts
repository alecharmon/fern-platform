/**
 * Stub replacement for @fern-docs/search-keyword in standalone bundle.
 */

export const SEARCH_INDEX = "fern-docs";
export const DEFAULT_SEARCH_API_KEY_EXPIRATION_SECONDS = 3600;

export interface FacetsResponse {
    [facet: string]: {
        [value: string]: number;
    };
}

export type { FacetFilter, FacetName } from "./search-keyword-types";

// Server-only function - not available in standalone bundle
// Users must provide their own API key directly to the search client
export async function getSearchApiKey(_options: any): Promise<string> {
    throw new Error("getSearchApiKey is not available in standalone bundle. Pass API key directly to search client.");
}
