"use client";

import { cn } from "@fern-docs/components/cn";
import { FernButton } from "@fern-docs/components/FernButton";
import { FernScrollArea } from "@fern-docs/components/FernScrollArea";
import * as Dialog from "@radix-ui/react-dialog";
import * as Tooltip from "@radix-ui/react-tooltip";
import { Expand, Search, X } from "lucide-react";
import React, { type ComponentProps, useCallback, useEffect, useRef, useState } from "react";

interface TableProps extends ComponentProps<"table"> {
    sticky?: boolean;
    searchable?: boolean;
}

/**
 * Filter table rows based on search query using DOM manipulation.
 * This approach works regardless of how the table is rendered (MDX, React components, etc.)
 * because it operates on the actual DOM elements after they're rendered.
 */
function useTableFilter(
    containerRef: React.RefObject<HTMLDivElement | null>,
    searchQuery: string,
    searchable: boolean
) {
    useEffect(() => {
        if (!searchable || !containerRef.current) {
            return;
        }

        const container = containerRef.current;
        const query = searchQuery.toLowerCase().trim();

        // Find all table rows in tbody elements
        const tbodyRows = container.querySelectorAll("tbody tr");

        tbodyRows.forEach((row) => {
            if (!query) {
                // Show all rows when search is empty
                (row as HTMLElement).style.display = "";
                return;
            }

            // Get text content from all cells in this row
            const cells = row.querySelectorAll("td, th");
            let rowMatches = false;

            cells.forEach((cell) => {
                const cellText = (cell.textContent || "").toLowerCase();
                if (cellText.includes(query)) {
                    rowMatches = true;
                }
            });

            // Show or hide the row based on whether any cell matches
            (row as HTMLElement).style.display = rowMatches ? "" : "none";
        });
    }, [containerRef, searchQuery, searchable]);
}

export function Table({ className, sticky, searchable, children, ...rest }: TableProps) {
    const [isFullScreen, setIsFullScreen] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const tableContainerRef = useRef<HTMLDivElement>(null);
    const fullscreenContainerRef = useRef<HTMLDivElement>(null);

    const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        setSearchQuery(e.target.value);
    }, []);

    const handleClearSearch = useCallback(() => {
        setSearchQuery("");
    }, []);

    // Apply filtering to both the main table and fullscreen table
    useTableFilter(tableContainerRef, searchQuery, searchable ?? false);
    useTableFilter(fullscreenContainerRef, searchQuery, searchable ?? false);

    const searchInput = searchable ? (
        <div className="fern-table-search">
            <Search className="fern-table-search-icon" />
            <input
                type="text"
                placeholder="Search..."
                value={searchQuery}
                onChange={handleSearchChange}
                className="fern-table-search-input"
            />
            {searchQuery && (
                <button
                    type="button"
                    onClick={handleClearSearch}
                    className="fern-table-search-clear"
                    aria-label="Clear search"
                >
                    <X className="size-3.5" />
                </button>
            )}
        </div>
    ) : null;

    if (sticky) {
        return (
            <div className="not-prose" ref={tableContainerRef}>
                {searchInput}
                <table {...rest} className={cn("fern-table sticky", className)}>
                    {children}
                </table>
            </div>
        );
    }

    return (
        <>
            <Tooltip.TooltipProvider delayDuration={300}>
                <Tooltip.Root>
                    <Tooltip.Trigger asChild>
                        <div
                            ref={tableContainerRef}
                            className={cn("fern-table-root not-prose", searchable && "searchable")}
                        >
                            {searchInput}
                            <FernScrollArea>
                                <table {...rest} className={cn("fern-table", className)}>
                                    {children}
                                </table>
                            </FernScrollArea>
                        </div>
                    </Tooltip.Trigger>
                    <Tooltip.Portal>
                        <Tooltip.Content side="right" align="start" sideOffset={6} className="animate-popover">
                            <FernButton variant="outlined" icon={<Expand />} onClick={() => setIsFullScreen(true)} />
                        </Tooltip.Content>
                    </Tooltip.Portal>
                </Tooltip.Root>
            </Tooltip.TooltipProvider>
            <Dialog.Root open={isFullScreen} onOpenChange={setIsFullScreen}>
                <Dialog.Portal>
                    <Dialog.Overlay className="bg-background/50 data-[state=open]:animate-overlay-show fixed inset-0 z-50 backdrop-blur-sm" />
                    <Dialog.Content
                        className="fixed inset-x-0 top-1/2 z-50 mx-auto flex max-h-[calc(100vh-2rem)] -translate-y-1/2 flex-col md:inset-x-4 md:max-h-[calc(100vh-8rem)] lg:inset-x-16 xl:inset-x-32"
                        asChild
                    >
                        <div ref={fullscreenContainerRef} className="fern-table-root not-prose fullscreen">
                            {searchInput}
                            <FernScrollArea>
                                <table {...rest} className={cn("fern-table", className)}>
                                    {children}
                                </table>
                            </FernScrollArea>
                        </div>
                    </Dialog.Content>
                </Dialog.Portal>
            </Dialog.Root>
        </>
    );
}
