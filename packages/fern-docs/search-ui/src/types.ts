import {
    type AlgoliaRecord,
    type ApiReferenceRecord,
    type ChangelogRecord,
    type FacetFilter,
    type FacetName,
    type MarkdownRecord,
    type ParameterRecord,
    SEARCHABLE_FACET_ATTRIBUTES
} from "@fern-docs/search-keyword/types";
import type { BaseHit, Hit } from "instantsearch.js";
import type { MarkRequired } from "ts-essentials";

export type AlgoliaRecordHit = Hit<AlgoliaRecord & BaseHit>;

export interface AskFernRecordHit {
    title?: string;
    url?: string;
}
export type MarkdownRecordHit = MarkRequired<Hit<MarkdownRecord>, "type">;
export type ChangelogRecordHit = MarkRequired<Hit<ChangelogRecord>, "type">;
export type ApiReferenceRecordHit = MarkRequired<Hit<ApiReferenceRecord>, "type">;
export type ParameterRecordHit = MarkRequired<Hit<ParameterRecord>, "type">;

export function isFacetName(facet: string): facet is FacetName {
    return SEARCHABLE_FACET_ATTRIBUTES.includes(facet as FacetName);
}

export interface FilterOption {
    facet: FacetName;
    value: string;
    count: number;
}

// Re-export types for convenience
export type { AlgoliaRecord, FacetFilter };
