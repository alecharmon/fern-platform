/**
 * Stub replacement for @fern-docs/search-keyword/types in standalone bundle.
 * This file is used by webpack to replace server-only imports.
 */

// Minimal type stubs
export const SEARCHABLE_FACET_ATTRIBUTES = [
    "product.title",
    "version.title",
    "type",
    "api_type",
    "method",
    "status_code",
    "availability"
] as const;

export type FacetName = (typeof SEARCHABLE_FACET_ATTRIBUTES)[number];

export interface FacetFilter {
    facet: FacetName;
    value: string;
}

// Stub types for records
export interface AlgoliaRecord {
    objectID: string;
    title: string;
    [key: string]: any;
}

export interface ApiReferenceRecord extends AlgoliaRecord {
    type: "api-reference";
}

export interface ChangelogRecord extends AlgoliaRecord {
    type: "changelog";
}

export interface MarkdownRecord extends AlgoliaRecord {
    type: "markdown";
}

export interface ParameterRecord extends AlgoliaRecord {
    type: "parameter";
}
