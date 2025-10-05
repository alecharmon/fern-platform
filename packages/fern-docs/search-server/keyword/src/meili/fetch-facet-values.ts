import type { MeiliSearch } from "meilisearch";

import { type FacetName, SEARCHABLE_FACET_ATTRIBUTES } from "../algolia/types";

export type FacetsResponse = Partial<Record<FacetName, { value: string; count: number }[]>>;

export async function fetchFacetValuesFromMeili(opts: {
    client: MeiliSearch;
    filters: string[];
}): Promise<FacetsResponse> {
    const { client, filters } = opts;
    const response: FacetsResponse = {
        type: [],
        api_type: [],
        method: [],
        status_code: [],
        "product.title": [],
        "version.title": [],
        availability: []
    };

    // Build filter string for Meilisearch
    // Algolia facetFilters are like ["type:markdown", "method:GET"]
    // Meilisearch expects filter: ["type = 'markdown'", "method = 'GET'"]
    const uniqueFilters = Array.from(new Set(filters));

    const meiliFilters = uniqueFilters
        .map((f) => {
            const [facet, value] = f.split(":");
            if (!value) return null;
            // Escape single quotes in value
            const safeValue = value.replace(/'/g, "\\'");
            return `${facet} = '${safeValue}'`;
        })
        .filter(Boolean) as string[];

    // For each facet, run a facet distribution query
    // Meilisearch does not support querying multiple facets at once for distribution
    // So we need to run one query per facet
    await Promise.all(
        SEARCHABLE_FACET_ATTRIBUTES.map(async (facet) => {
            try {
                const searchRes = await client.index("docs").search("", {
                    facets: [facet],
                    filter: meiliFilters.length > 0 ? meiliFilters : undefined,
                    limit: 1,
                    distinct: "distinct"
                });

                const facetDist = searchRes.facetDistribution?.[facet];
                if (facetDist && typeof facetDist === "object") {
                    const facetHits = Object.entries(facetDist)
                        .filter(([_, count]) => Number(count) > 0)
                        .map(([value, count]) => ({
                            value,
                            count: Number(count)
                        }));
                    if (facetHits.length > 1) {
                        response[facet as FacetName] = facetHits;
                    }
                }
            } catch (err) {
                // Log and skip this facet
                console.error(`[meili/fetch-facet-values] ${facet}: ${JSON.stringify(err)}`);
            }
        })
    );

    return response;
}
