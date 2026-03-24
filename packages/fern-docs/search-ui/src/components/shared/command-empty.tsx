import { isSelfHosted } from "@fern-api/docs-server";
import { t } from "@fern-docs/i18n";
import { type ComponentProps, forwardRef } from "react";
import { useInstantSearch } from "react-instantsearch";
import { useInfiniteSearchHits } from "../../hooks/use-search-hits";
import * as Command from "../cmdk";
import { useFacetFilters } from "../search/useFacetFilters";

function useSearchStatus(): "idle" | "loading" | "stalled" | "error" {
    if (isSelfHosted()) {
        return "idle";
    }
    const { status } = useInstantSearch();
    return status;
}

export const CommandEmpty = forwardRef<HTMLDivElement, ComponentProps<typeof Command.Empty> & { lang: string }>(
    ({ children, lang, ...props }, ref) => {
        const query = Command.useCommandState((state) => state.search);
        const { items } = useInfiniteSearchHits();
        const { filters } = useFacetFilters();
        const searchStatus = useSearchStatus();
        const hasActiveFilters = filters.length > 0;
        const isQueryEmpty = typeof query === "string" && query.trimStart().length === 0;

        // Early return when query is empty/nullish and no filters are active.
        // Without this guard, the fallback "No results found for ""." message would
        // render with empty quotes — especially problematic for self-hosted (MeiliSearch)
        // deployments where useSearchStatus() always returns "idle".
        if (isQueryEmpty && !hasActiveFilters) {
            return null;
        }

        // Don't show "no results" while search is still loading
        if (searchStatus === "loading" || searchStatus === "stalled") {
            return null;
        }

        if (items.length > 0) {
            return null;
        }

        const emptyStyle = {
            padding: "1.5rem 0",
            textAlign: "center" as const,
            color: "var(--cmdk-empty-color, #888)",
            ...props.style
        };

        if (hasActiveFilters && isQueryEmpty) {
            return (
                children ?? (
                    <div {...props} ref={ref} data-cmdk-empty="" role="presentation" style={emptyStyle}>
                        {t(lang).search.noResultsFoundForFilters}
                    </div>
                )
            );
        }

        return (
            children ?? (
                <div {...props} ref={ref} data-cmdk-empty="" role="presentation" style={emptyStyle}>
                    {t(lang).search.noResultsFoundFor}
                    {" \u201C"}
                    {query}
                    {"\u201D."}
                </div>
            )
        );
    }
);

CommandEmpty.displayName = "CommandEmpty";
