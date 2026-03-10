import { algoliaAppId, meilisearchApiKey, meilisearchOrigin } from "@fern-api/docs-server/env-variables";
import { isLocal } from "@fern-api/docs-server/isLocal";
import { isSelfHosted } from "@fern-api/docs-server/isSelfHosted";
import { selectFirst } from "@fern-api/docs-server/utils/selectFirst";
import { toArray } from "@fern-api/docs-server/utils/toArray";
import { fetchFacetValuesFromAlgolia, fetchFacetValuesFromMeili } from "@fern-docs/search-keyword";
import { algoliasearch } from "algoliasearch";
import { MeiliSearch } from "meilisearch";
import { type NextRequest, NextResponse } from "next/server";

export const maxDuration = 10;

export async function GET(req: NextRequest): Promise<NextResponse> {
    if (isLocal()) {
        return NextResponse.json("search facet is not accessible in local preview mode", { status: 400 });
    }

    const filters = toArray(req.nextUrl.searchParams.getAll("filters"));

    // Self-hosted mode uses internal MeiliSearch key, so apiKey is not required
    if (isSelfHosted()) {
        const facetValues = await fetchFacetValuesFromMeili({
            filters,
            client: new MeiliSearch({
                host: meilisearchOrigin(),
                apiKey: meilisearchApiKey()
            })
        });

        return NextResponse.json(facetValues);
    }

    // For non-self-hosted (Algolia), apiKey is required
    const apiKey = selectFirst(req.nextUrl.searchParams.get("apiKey"));

    if (!apiKey) {
        return NextResponse.json("apiKey is required", { status: 400 });
    }

    const facetValues = await fetchFacetValuesFromAlgolia({
        filters,
        client: algoliasearch(algoliaAppId(), apiKey)
    });

    return NextResponse.json(facetValues);
}
