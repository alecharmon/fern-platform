import type { Algoliasearch, BrowseResponse } from "algoliasearch";

export async function browseAllObjectsForDomain(
    algolia: Algoliasearch,
    domain: string,
    indexName: string,
    attributesToRetrieve?: string[],
    basepath?: string[]
): Promise<Record<string, any>[]> {
    let filters: string;
    if (basepath == null || basepath.length === 0) {
        filters = `domain:${domain}`;
    } else if (basepath.length === 1) {
        filters = `domain:${domain} AND basepath:${basepath[0]}`;
    } else {
        const basepathFilter = basepath.map((bp) => `basepath:${bp}`).join(" OR ");
        filters = `domain:${domain} AND (${basepathFilter})`;
    }
    return browseAllObjectsForFilters(algolia, filters, indexName, attributesToRetrieve, false);
}

export async function browseAllObjectsForFilters(
    algolia: Algoliasearch,
    filters: string,
    indexName: string,
    attributesToRetrieve?: string[],
    distinct?: boolean
): Promise<Record<string, any>[]> {
    let response: BrowseResponse;
    let cursor: string | undefined;
    const hits: Record<string, any>[] = [];
    do {
        response = await algolia.browse({
            browseParams: {
                filters,
                hitsPerPage: 1000,
                cursor,
                attributesToRetrieve,
                distinct
            },
            indexName
        });
        cursor = response.cursor;
        hits.push(...response.hits);
    } while (cursor != null);
    return hits;
}
