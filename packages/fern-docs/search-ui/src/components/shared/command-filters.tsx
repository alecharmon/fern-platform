import { Badge } from "@fern-docs/components/badges";
import { t } from "@fern-docs/i18n";

import { ChevronsDownUp, ChevronsUpDown, ListFilter } from "lucide-react";
import { type ComponentPropsWithoutRef, forwardRef, useState } from "react";

import { FACET_DISPLAY_NAME_MAP, getFacetDisplay, toFilterOptions } from "../../utils/facet-display";
import * as Command from "../cmdk";
import { useFacets, usePreloadFacets } from "../search/algolia-search-client";
import { useFacetFilters } from "../search/useFacetFilters";
import { useSearchBox } from "../search/useSearchBox";

const MAX_VISIBLE_FILTERS = 3;

export const CommandGroupFilters = forwardRef<
    HTMLDivElement,
    ComponentPropsWithoutRef<typeof Command.Group> & { lang: string }
>(({ lang, ...props }, ref) => {
    const { clear } = useSearchBox();
    const { filters, setFilters } = useFacetFilters();
    const options = toFilterOptions(useFacets(filters).facets);
    const preloadFacets = usePreloadFacets();
    const [expanded, setExpanded] = useState(false);

    if (options.length <= 1) {
        return false;
    }

    const hasMore = options.length > MAX_VISIBLE_FILTERS;
    const visibleOptions = expanded ? options : options.slice(0, MAX_VISIBLE_FILTERS);

    return (
        <Command.Group ref={ref} heading={t(lang).search.filters} {...props}>
            {visibleOptions.map((filter) => (
                <Command.Item
                    key={`${filter.facet}:"${filter.value}"`}
                    value={`filter ${filter.facet} to ${filter.value}`}
                    data-disable-auto-selection
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
            {hasMore &&
                (expanded ? (
                    <Command.Item
                        value="show-less-filters"
                        data-disable-auto-selection
                        onSelect={() => setExpanded(false)}
                    >
                        <ChevronsDownUp className="size-4" />
                        <span>{t(lang).search.showLessFilters}</span>
                    </Command.Item>
                ) : (
                    <Command.Item
                        value="show-more-filters"
                        data-disable-auto-selection
                        onSelect={() => setExpanded(true)}
                    >
                        <ChevronsUpDown className="size-4" />
                        <span>
                            {t(lang).search.showMoreFilters} ({options.length - MAX_VISIBLE_FILTERS})
                        </span>
                    </Command.Item>
                ))}
        </Command.Group>
    );
});

CommandGroupFilters.displayName = "CommandGroupFilters";
