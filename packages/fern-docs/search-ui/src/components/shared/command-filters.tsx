import { Badge } from "@fern-docs/components/badges";
import { t } from "@fern-docs/i18n";

import { ListFilter } from "lucide-react";
import { type ComponentPropsWithoutRef, forwardRef } from "react";

import { FACET_DISPLAY_NAME_MAP, getFacetDisplay, toFilterOptions } from "../../utils/facet-display";
import * as Command from "../cmdk";
import { useFacets, usePreloadFacets } from "../search/algolia-search-client";
import { useFacetFilters } from "../search/useFacetFilters";
import { useSearchBox } from "../search/useSearchBox";

export const CommandGroupFilters = forwardRef<
    HTMLDivElement,
    ComponentPropsWithoutRef<typeof Command.Group> & { lang: string }
>(({ lang, ...props }, ref) => {
    const { clear } = useSearchBox();
    const { filters, setFilters } = useFacetFilters();
    const options = toFilterOptions(useFacets(filters).facets);
    const preloadFacets = usePreloadFacets();

    if (options.length === 0) {
        return false;
    }

    return (
        <Command.Group ref={ref} heading="Filters" {...props}>
            {options.map((filter) => (
                <Command.Item
                    key={`${filter.facet}:"${filter.value}"`}
                    value={`filter ${filter.facet} to ${filter.value}`}
                    onSelect={() => {
                        setFilters((prev) => [...prev, filter]);
                        clear();
                    }}
                    onPointerOver={() => {
                        void preloadFacets([filter]);
                    }}
                    keywords={[FACET_DISPLAY_NAME_MAP[filter.facet]?.[filter.value] ?? filter.value]}
                >
                    <ListFilter />
                    <span className="flex flex-1 flex-row items-center gap-1">
                        {t(lang).search.filterTo} {getFacetDisplay(filter.facet, filter.value)}
                    </span>
                    <Badge size="sm" rounded>
                        {filter.count}
                    </Badge>
                </Command.Item>
            ))}
        </Command.Group>
    );
});

CommandGroupFilters.displayName = "CommandGroupFilters";
