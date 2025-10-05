import { Badge } from "@fern-docs/components/badges";
import { cn } from "@fern-docs/components/cn";
import type { FacetFilter } from "@fern-docs/search-keyword";
import { ChevronDown, ChevronUp, Minus } from "lucide-react";
import { cloneElement, isValidElement, useState } from "react";

import { getFacetDisplay, toFilterLabel } from "../../utils/facet-display";
import { useFacets } from "../search/algolia-search-client";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuPortal,
    DropdownMenuRadioGroup,
    DropdownMenuRadioItem,
    DropdownMenuSeparator,
    DropdownMenuShortcut,
    DropdownMenuTrigger
} from "../ui/dropdown";

export function DesktopFilterDropdownMenu({
    filter,
    filters,
    removeFilter,
    updateFilter,
    onCloseAutoFocus,
    inSidePanel = false,
    className,
    open,
    onOpenChange
}: {
    filter: FacetFilter;
    removeFilter?: () => void;
    updateFilter?: (value: string) => void;
    filters: readonly FacetFilter[];
    onCloseAutoFocus?: (event: Event) => void;
    inSidePanel?: boolean;
    className?: string;
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
}) {
    const [isOpen, setIsOpen] = useState(false);

    const isDropdownOpen = open !== undefined ? open : isOpen;
    const handleOpenChange = onOpenChange || setIsOpen;
    const otherFilters = filters.filter((f) => f.facet !== filter.facet);

    const { facets } = useFacets(otherFilters);

    const options = facets?.[filter.facet] ?? [];

    const facetDisplay = getFacetDisplay(filter.facet, filter.value, {
        small: true,
        titleCase: true
    });

    return (
        <DropdownMenu open={isDropdownOpen} onOpenChange={handleOpenChange}>
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                <span className="flex min-w-0 items-center gap-1">
                    {isValidElement<{
                        interactive?: boolean;
                        height?: string;
                        chevronProps?: { show: boolean; isOpen: boolean };
                    }>(facetDisplay) ? (
                        cloneElement(facetDisplay, {
                            interactive: true,
                            height: inSidePanel ? "sm" : undefined,
                            chevronProps: { show: true, isOpen: isDropdownOpen }
                        })
                    ) : (
                        <Badge variant="outlined-subtle" size="sm" interactive>
                            {facetDisplay}
                            {isDropdownOpen ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
                        </Badge>
                    )}
                </span>
            </DropdownMenuTrigger>
            <DropdownMenuPortal>
                <DropdownMenuContent
                    className={cn("min-w-[200px]", className)}
                    onKeyDownCapture={(e) => {
                        if (e.key === "Backspace") {
                            removeFilter?.();
                        }
                    }}
                    onCloseAutoFocus={onCloseAutoFocus}
                >
                    <DropdownMenuLabel>{toFilterLabel(filter.facet)}</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {options.length > 0 && (
                        <>
                            <DropdownMenuRadioGroup
                                value={filter.value}
                                onValueChange={(value) => {
                                    updateFilter?.(value);
                                }}
                            >
                                {options.map((option) => (
                                    <DropdownMenuRadioItem
                                        key={option.value}
                                        value={option.value}
                                        autoFocus={option.value === filter.value}
                                    >
                                        {getFacetDisplay(filter.facet, option.value)}
                                        <Badge size="sm" rounded className="ml-auto">
                                            {option.count}
                                        </Badge>
                                    </DropdownMenuRadioItem>
                                ))}
                            </DropdownMenuRadioGroup>
                            <DropdownMenuSeparator />
                        </>
                    )}
                    <DropdownMenuGroup>
                        <DropdownMenuItem
                            onSelect={() => {
                                removeFilter?.();
                            }}
                        >
                            <Minus className="size-4" />
                            Remove filter
                            {!inSidePanel && <DropdownMenuShortcut>Del</DropdownMenuShortcut>}
                        </DropdownMenuItem>
                    </DropdownMenuGroup>
                </DropdownMenuContent>
            </DropdownMenuPortal>
        </DropdownMenu>
    );
}
