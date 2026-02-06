import type { FernNavigation } from "@fern-api/fdr-sdk";

export function flattenChangelogEntries({
    node,
    selectedFilters = []
}: {
    node: FernNavigation.ChangelogNode;
    selectedFilters?: string[];
}): FernNavigation.ChangelogEntryNode[] {
    return node.children.flatMap((year) =>
        year.children
            .flatMap((month) => month.children)
            .filter((entry) => {
                const matchesFilter =
                    selectedFilters.length === 0 || entry.tags?.some((tag) => selectedFilters.includes(tag));
                return matchesFilter;
            })
    );
}
