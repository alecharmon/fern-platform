"use client";

import { EMPTY_ARRAY } from "@fern-api/ui-core-utils";
import { Badge } from "@fern-docs/components/badges";
import { t } from "@fern-docs/i18n";
import type { FacetFilter } from "@fern-docs/search-keyword";
import { type FacetName, SEARCHABLE_FACET_ATTRIBUTES } from "@fern-docs/search-keyword/types";
import { ChevronDown, ChevronUp, X } from "lucide-react";
import { type ReactNode, useState } from "react";

import { getFacetDisplay, toFilterLabel } from "../../utils/facet-display";
import { useFacets, usePreloadFacets } from "../search/algolia-search-client";
import { useFacetFilters } from "../search/useFacetFilters";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger
} from "../ui/dropdown";

const FACET_ORDER: readonly FacetName[] = SEARCHABLE_FACET_ATTRIBUTES;

/**
 * A horizontal filter bar with Notion-style dropdown pills.
 * Each facet with available options is rendered as a dropdown trigger.
 * Selected filters appear as active pills with an X to remove.
 * Only one value can be selected per facet at a time.
 */
export function DesktopFilterBar({ lang }: { lang: string }): ReactNode {
    const { filters, setFilters } = useFacetFilters();
    const { facets: facetsResponse } = useFacets(EMPTY_ARRAY);
    const preloadFacets = usePreloadFacets();
    const [openFacet, setOpenFacet] = useState<string | null>(null);

    const availableFacets = FACET_ORDER.filter((facet) => {
        const options = facetsResponse?.[facet];
        if (options == null || options.length === 0) {
            return false;
        }
        if (facet === "api_type" && options.length <= 1) {
            return false;
        }
        return true;
    });

    const hasActiveFilters = filters.length > 0;
    const totalOptions = availableFacets.reduce((sum, facet) => sum + (facetsResponse?.[facet]?.length ?? 0), 0);

    if (!hasActiveFilters && (availableFacets.length === 0 || totalOptions <= 1)) {
        return false;
    }

    const selectedFacetValue = (facet: FacetName): string | undefined => filters.find((f) => f.facet === facet)?.value;

    const handleSelectFilter = (facet: FacetName, value: string) => {
        setFilters((prev) => {
            const withoutFacet = prev.filter((f) => f.facet !== facet);
            return [...withoutFacet, { facet, value }];
        });
    };

    const handleRemoveFilter = (facet: FacetName) => {
        setFilters((prev) => prev.filter((f) => f.facet !== facet));
    };

    // Include facets that have active filters even if they have no options
    const activeFacets = filters
        .map((f) => f.facet)
        .filter((facet): facet is FacetName => !availableFacets.includes(facet));
    const facetsToRender = [...availableFacets, ...activeFacets];

    return (
        <div className="border-border-default flex flex-wrap items-center gap-2 border-b p-2">
            {facetsToRender.map((facet) => {
                const selected = selectedFacetValue(facet);
                const isOpen = openFacet === facet;

                return (
                    <FacetDropdown
                        key={facet}
                        facet={facet}
                        selectedValue={selected}
                        filters={filters}
                        open={isOpen}
                        onOpenChange={(open) => setOpenFacet(open ? facet : null)}
                        onSelect={(value) => handleSelectFilter(facet, value)}
                        onRemove={() => handleRemoveFilter(facet)}
                        onPreload={(filter) => void preloadFacets([filter])}
                        lang={lang}
                    />
                );
            })}
        </div>
    );
}

function FacetDropdown({
    facet,
    selectedValue,
    filters,
    open,
    onOpenChange,
    onSelect,
    onRemove,
    onPreload,
    lang
}: {
    facet: FacetName;
    selectedValue?: string;
    filters: readonly FacetFilter[];
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSelect: (value: string) => void;
    onRemove: () => void;
    onPreload: (filter: FacetFilter) => void;
    lang: string;
}) {
    const otherFilters = filters.filter((f) => f.facet !== facet);
    const { facets } = useFacets(otherFilters);
    const options = facets?.[facet] ?? EMPTY_ARRAY;

    const label = toFilterLabel(facet);
    const isActive = selectedValue != null;

    if (options.length === 0 && !isActive) {
        return null;
    }

    if (isActive && options.length === 0) {
        return (
            <button
                type="button"
                className="bg-(color:--accent-a3) text-(color:--accent-a11) border-(color:--accent-a7) inline-flex h-7 cursor-pointer items-center gap-1 rounded-3/2 border px-2.5 text-xs font-medium transition-colors [&_.fern-docs-badge]:-ml-1.5"
                onClick={() => onRemove()}
            >
                <span className="inline-flex items-center gap-1">
                    {getFacetDisplay(facet, selectedValue, { small: true, titleCase: true })}
                </span>
                <span className="hover:text-(color:--accent-a12) -mr-1 ml-0.5 inline-flex rounded-sm p-0.5">
                    <X className="size-3" />
                </span>
            </button>
        );
    }

    return (
        <DropdownMenu open={open} onOpenChange={onOpenChange}>
            <DropdownMenuTrigger asChild>
                <button
                    type="button"
                    className={`inline-flex h-7 cursor-pointer items-center gap-1 rounded-3/2 border px-2.5 text-xs font-medium transition-colors [&_.fern-docs-badge]:-ml-1.5 ${
                        isActive
                            ? "bg-(color:--accent-a3) text-(color:--accent-a11) border-(color:--accent-a7)"
                            : "border-border-default bg-transparent text-(color:--grayscale-a11) hover:bg-(color:--grayscale-a3)"
                    }`}
                >
                    {isActive ? (
                        <>
                            <span className="inline-flex items-center gap-1">
                                {getFacetDisplay(facet, selectedValue, { small: true, titleCase: true })}
                            </span>
                            <span
                                role="button"
                                tabIndex={0}
                                className="hover:text-(color:--accent-a12) -mr-1 ml-0.5 inline-flex rounded-sm p-0.5"
                                onPointerDown={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    onRemove();
                                }}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter" || e.key === " ") {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        onRemove();
                                    }
                                }}
                            >
                                <X className="size-3" />
                            </span>
                        </>
                    ) : (
                        <>
                            {label}
                            {open ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
                        </>
                    )}
                </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="z-[9999] max-h-[300px] min-w-[180px] overflow-y-auto">
                <DropdownMenuGroup>
                    {options.map((option) => (
                        <DropdownMenuItem
                            key={option.value}
                            onSelect={() => onSelect(option.value)}
                            onPointerOver={() => onPreload({ facet, value: option.value })}
                        >
                            <span className="inline-flex items-center gap-1">
                                {getFacetDisplay(facet, option.value, { titleCase: true })}
                            </span>
                            <Badge size="sm" rounded className="ml-auto">
                                {option.count}
                            </Badge>
                        </DropdownMenuItem>
                    ))}
                </DropdownMenuGroup>
                {isActive && (
                    <>
                        <DropdownMenuSeparator />
                        <DropdownMenuGroup>
                            <DropdownMenuItem onSelect={() => onRemove()}>
                                <X className="size-4" />
                                {t(lang).search.removeFilter}
                            </DropdownMenuItem>
                        </DropdownMenuGroup>
                    </>
                )}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
