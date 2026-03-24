"use client";

import { Badge } from "@fern-docs/components/badges";
import { Button } from "@fern-docs/components/button";
import { t } from "@fern-docs/i18n";
import type { FacetFilter } from "@fern-docs/search-keyword";
import { ListFilter, Plus } from "lucide-react";
import { useState } from "react";

import { getFacetDisplay, toFilterOptions } from "../../utils/facet-display";
import { Filter } from "../icons/filter";
import { useFacets, usePreloadFacets } from "../search/algolia-search-client";
import { useFacetFilters } from "../search/useFacetFilters";
import { useSearchBox } from "../search/useSearchBox";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuPortal,
    DropdownMenuSeparator,
    DropdownMenuTrigger
} from "../ui/dropdown";
import { DesktopFilterDropdownMenu } from "./desktop-filter-dropdown-menu";

export const FilterDropdownMenu = ({
    filters,
    open,
    onOpenChange,
    lang
}: {
    filters: readonly FacetFilter[];
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
    lang: string;
}) => {
    const { clear } = useSearchBox();
    const { setFilters } = useFacetFilters();
    const options = toFilterOptions(useFacets(filters).facets);
    const preloadFacets = usePreloadFacets();

    if (options.length <= 1) {
        return (
            <Button
                size="icon"
                className="h-[32px] w-[32px] cursor-pointer opacity-50 hover:bg-transparent focus:outline-none"
                variant="ghost"
                disabled
            >
                <Filter className="h-4 w-4" fill="var(--accent-contrast)" />
            </Button>
        );
    }

    return (
        <DropdownMenu open={open} onOpenChange={onOpenChange}>
            <DropdownMenuTrigger asChild>
                <Button size="icon" className="h-[32px] w-[32px]" variant="ghost">
                    <Filter className="h-4 w-4" fill="var(--accent-contrast)" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuPortal>
                <DropdownMenuContent className="z-[9999] min-w-[200px]">
                    <DropdownMenuLabel>{t(lang).search.addFilter}</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuGroup>
                        {options.map((filter) => (
                            <DropdownMenuItem
                                key={`${filter.facet}:"${filter.value}"`}
                                onSelect={() => {
                                    setFilters((prev) => {
                                        const withoutFacet = prev.filter((f) => f.facet !== filter.facet);
                                        return [...withoutFacet, filter];
                                    });
                                    clear();
                                }}
                                onPointerOver={() => {
                                    void preloadFacets([filter]);
                                }}
                            >
                                <ListFilter className="mr-2 h-4 w-4" />
                                <span className="flex flex-1 flex-row items-center gap-1">
                                    {t(lang).search.filterTo} {getFacetDisplay(filter.facet, filter.value)}
                                </span>
                                <Badge size="sm" rounded className="ml-auto">
                                    {filter.count}
                                </Badge>
                            </DropdownMenuItem>
                        ))}
                    </DropdownMenuGroup>
                </DropdownMenuContent>
            </DropdownMenuPortal>
        </DropdownMenu>
    );
};

export const AddFilterButton = ({
    filters,
    open,
    onOpenChange,
    lang
}: {
    filters: readonly FacetFilter[];
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
    lang: string;
}) => {
    const { clear } = useSearchBox();
    const { setFilters } = useFacetFilters();
    const options = toFilterOptions(useFacets(filters).facets);
    const preloadFacets = usePreloadFacets();

    if (options.length <= 1) {
        return null;
    }

    return (
        <DropdownMenu open={open} onOpenChange={onOpenChange}>
            <DropdownMenuTrigger asChild>
                <Badge variant="outlined-subtle" size="sm" className="cursor-pointer px-1 py-0" interactive>
                    <Plus className="h-3 w-3" />
                </Badge>
            </DropdownMenuTrigger>
            <DropdownMenuPortal>
                <DropdownMenuContent className="z-[9999] min-w-[200px]">
                    <DropdownMenuLabel>{t(lang).search.addFilter}</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuGroup>
                        {options.map((filter) => (
                            <DropdownMenuItem
                                key={`${filter.facet}:"${filter.value}"`}
                                onSelect={() => {
                                    setFilters((prev) => {
                                        const withoutFacet = prev.filter((f) => f.facet !== filter.facet);
                                        return [...withoutFacet, filter];
                                    });
                                    clear();
                                }}
                                onPointerOver={() => {
                                    void preloadFacets([filter]);
                                }}
                            >
                                <ListFilter className="mr-2 h-4 w-4" />
                                <span className="flex flex-1 flex-row items-center gap-1">
                                    {t(lang).search.filterTo} {getFacetDisplay(filter.facet, filter.value)}
                                </span>
                                <Badge size="sm" rounded className="ml-auto">
                                    {filter.count}
                                </Badge>
                            </DropdownMenuItem>
                        ))}
                    </DropdownMenuGroup>
                </DropdownMenuContent>
            </DropdownMenuPortal>
        </DropdownMenu>
    );
};

export const FilterManager = ({ filters, lang }: { filters: readonly FacetFilter[]; lang: string }) => {
    const { setFilters } = useFacetFilters();
    const [openDropdown, setOpenDropdown] = useState<string | null>(null);

    const removeFilter = (index: number) => {
        setFilters((prev) => prev.filter((_, i) => i !== index));
    };

    const updateFilter = (index: number, value: string) => {
        setFilters((prev) => prev.map((filter, i) => (i === index ? { ...filter, value } : filter)));
    };

    const handleFilterDropdownChange = (open: boolean) => {
        setOpenDropdown(open ? "filter" : null);
    };

    const handleAddFilterChange = (open: boolean) => {
        setOpenDropdown(open ? "add" : null);
    };

    const handleFilterBadgeChange = (index: number) => (open: boolean) => {
        setOpenDropdown(open ? `badge-${index}` : null);
    };

    return (
        <div className="flex max-w-full flex-wrap items-center gap-1">
            {filters.length === 0 ? (
                <FilterDropdownMenu
                    filters={filters}
                    open={openDropdown === "filter"}
                    onOpenChange={handleFilterDropdownChange}
                    lang={lang}
                />
            ) : (
                <>
                    {filters.map((filter, index) => (
                        <DesktopFilterDropdownMenu
                            key={`${filter.facet}:"${filter.value}"`}
                            filter={filter}
                            filters={filters}
                            removeFilter={() => removeFilter(index)}
                            updateFilter={(value) => updateFilter(index, value)}
                            inSidePanel={true}
                            className="z-[9999]"
                            open={openDropdown === `badge-${index}`}
                            onOpenChange={handleFilterBadgeChange(index)}
                            lang={lang}
                        />
                    ))}
                    <AddFilterButton
                        filters={filters}
                        open={openDropdown === "add"}
                        onOpenChange={handleAddFilterChange}
                        lang={lang}
                    />
                </>
            )}
        </div>
    );
};
