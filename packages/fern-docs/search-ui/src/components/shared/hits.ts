import type { AlgoliaRecordHit } from "../../types";

export interface GroupedHit {
    title: string;
    path: string;
    icon?: string;
    record?: AlgoliaRecordHit;
}

export interface GroupedHits {
    title?: string;
    hits: GroupedHit[];
}

export function generateHits(
    items: AlgoliaRecordHit[],
    currentVersion?: string,
    currentProduct?: string
): GroupedHits[] {
    // prefer the current product and version for rankings
    const sortedItems = [...items].sort((a, b) => {
        const aMatchesVersion = currentVersion != null && a.version?.id === currentVersion;
        const bMatchesVersion = currentVersion != null && b.version?.id === currentVersion;
        const aMatchesProduct = currentProduct != null && a.product?.id === currentProduct;
        const bMatchesProduct = currentProduct != null && b.product?.id === currentProduct;

        const aMatchesBoth = aMatchesVersion && aMatchesProduct;
        const bMatchesBoth = bMatchesVersion && bMatchesProduct;

        if (aMatchesBoth && !bMatchesBoth) {
            return -1;
        }
        if (!aMatchesBoth && bMatchesBoth) {
            return 1;
        }

        if (aMatchesProduct && !bMatchesProduct) {
            return -1;
        }
        if (!aMatchesProduct && bMatchesProduct) {
            return 1;
        }

        if (aMatchesVersion && !bMatchesVersion) {
            return -1;
        }
        if (!aMatchesVersion && bMatchesVersion) {
            return 1;
        }

        return 0;
    });

    return [
        {
            title: "Results",
            hits: sortedItems.map((hit) => ({
                title: hit.title,
                path: `${hit.pathname}${hit.hash ?? ""}`,
                // category: SEGMENT_DISPLAY_NAMES[hit.type === "api-reference" ? hit.api_type : hit.type],
                icon: hit.icon,
                record: hit
            }))
        }
    ];
}
