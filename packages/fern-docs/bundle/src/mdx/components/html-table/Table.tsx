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
    placeholder?: string;
}

/**
 * Information about a cell that spans multiple rows.
 */
interface SpanningCellInfo {
    cell: HTMLElement;
    sourceRowIndex: number;
    cellIndex: number;
    originalRowSpan: number;
}

/**
 * Build a map of which rows have cells that span into them from previous rows.
 * Returns a Map where key is a row index and value is an array of SpanningCellInfo
 * describing cells that span into that row.
 *
 * @param rows - The table rows to analyze
 */
function buildRowSpanMap(rows: NodeListOf<Element>): Map<number, SpanningCellInfo[]> {
    const spanMap = new Map<number, SpanningCellInfo[]>();

    rows.forEach((row, rowIndex) => {
        const cells = row.querySelectorAll("td, th");
        let cellIndex = 0;
        cells.forEach((cell) => {
            const htmlCell = cell as HTMLElement;
            const rowSpanValue = htmlCell.dataset.originalRowspan || htmlCell.getAttribute("rowspan") || "1";
            const rowSpan = parseInt(rowSpanValue, 10);
            if (rowSpan > 1) {
                for (let i = 1; i < rowSpan; i++) {
                    const targetRow = rowIndex + i;
                    if (!spanMap.has(targetRow)) {
                        spanMap.set(targetRow, []);
                    }
                    spanMap.get(targetRow)!.push({
                        cell: htmlCell,
                        sourceRowIndex: rowIndex,
                        cellIndex,
                        originalRowSpan: rowSpan
                    });
                }
            }
            cellIndex++;
        });
    });

    return spanMap;
}

/**
 * Filter table rows based on search query using DOM manipulation.
 * This approach works regardless of how the table is rendered (MDX, React components, etc.)
 * because it operates on the actual DOM elements after they're rendered.
 *
 * This function properly handles rowSpan by:
 * 1. Only showing rows that match the search query
 * 2. For visible rows that have cells spanning from hidden rows, cloning those cells
 * 3. Adjusting rowSpan values to only cover visible rows
 */
function useTableFilter(containerRef: React.RefObject<HTMLDivElement | null>, searchQuery: string) {
    useEffect(() => {
        if (!containerRef.current) {
            return;
        }

        const container = containerRef.current;
        const query = searchQuery.toLowerCase().trim();

        // Find all table rows in tbody elements
        const tbodyRows = container.querySelectorAll("tbody tr");

        // Remove any previously cloned cells
        container.querySelectorAll("[data-cloned-cell]").forEach((cell) => cell.remove());

        if (!query) {
            // Show all rows and reset rowSpan values when search is empty
            tbodyRows.forEach((row) => {
                (row as HTMLElement).style.display = "";
                const cells = row.querySelectorAll("td, th");
                cells.forEach((cell) => {
                    const htmlCell = cell as HTMLElement;
                    const originalRowSpan = htmlCell.dataset.originalRowspan;
                    if (originalRowSpan) {
                        htmlCell.setAttribute("rowspan", originalRowSpan);
                    }
                    // Show cells that were hidden because they were cloned
                    if (htmlCell.dataset.hiddenForClone) {
                        htmlCell.style.display = "";
                        delete htmlCell.dataset.hiddenForClone;
                    }
                });
            });
            return;
        }

        // Store original rowSpan values if not already stored
        tbodyRows.forEach((row) => {
            const cells = row.querySelectorAll("td, th");
            cells.forEach((cell) => {
                const htmlCell = cell as HTMLElement;
                if (!htmlCell.dataset.originalRowspan) {
                    const rowSpan = htmlCell.getAttribute("rowspan");
                    if (rowSpan) {
                        htmlCell.dataset.originalRowspan = rowSpan;
                    }
                }
            });
        });

        // Build the rowSpan map
        const spanMap = buildRowSpanMap(tbodyRows);

        // First pass: determine which rows match the query
        // Also check if spanning cells match (they should make their source row match)
        const matchingRows = new Set<number>();
        tbodyRows.forEach((row, rowIndex) => {
            const cells = row.querySelectorAll("td, th");
            let rowMatches = false;

            cells.forEach((cell) => {
                const cellText = (cell.textContent || "").toLowerCase();
                if (cellText.includes(query)) {
                    rowMatches = true;
                }
            });

            if (rowMatches) {
                matchingRows.add(rowIndex);
            }
        });

        // Also check spanning cells - if a spanning cell matches, add its source row
        spanMap.forEach((spanningCells) => {
            spanningCells.forEach((info) => {
                const cellText = (info.cell.textContent || "").toLowerCase();
                if (cellText.includes(query)) {
                    matchingRows.add(info.sourceRowIndex);
                }
            });
        });

        // Second pass: show/hide rows
        tbodyRows.forEach((row, rowIndex) => {
            const htmlRow = row as HTMLElement;
            const shouldShow = matchingRows.has(rowIndex);
            htmlRow.style.display = shouldShow ? "" : "none";
        });

        // Third pass: handle spanning cells
        // For each visible row, check if it needs cells from hidden rows
        tbodyRows.forEach((row, rowIndex) => {
            if (!matchingRows.has(rowIndex)) {
                return;
            }

            const htmlRow = row as HTMLElement;
            const spanningCells = spanMap.get(rowIndex) || [];

            // Track which cells we need to clone into this row
            const cellsToClone: { cell: HTMLElement; cellIndex: number; newRowSpan: number }[] = [];

            spanningCells.forEach((info) => {
                // Check if the source row is hidden
                if (!matchingRows.has(info.sourceRowIndex)) {
                    // Calculate the new rowSpan for this cell
                    // Count visible rows from this row onwards that the cell spans into
                    let newRowSpan = 0;
                    for (let i = rowIndex; i < info.sourceRowIndex + info.originalRowSpan; i++) {
                        if (matchingRows.has(i)) {
                            newRowSpan++;
                        }
                    }

                    if (newRowSpan > 0) {
                        cellsToClone.push({
                            cell: info.cell,
                            cellIndex: info.cellIndex,
                            newRowSpan
                        });
                    }
                }
            });

            // Clone cells into this row at the correct positions
            // Sort by cellIndex to insert in correct order
            cellsToClone.sort((a, b) => a.cellIndex - b.cellIndex);

            cellsToClone.forEach((cloneInfo) => {
                const clonedCell = cloneInfo.cell.cloneNode(true) as HTMLElement;
                clonedCell.setAttribute("rowspan", String(cloneInfo.newRowSpan));
                clonedCell.dataset.clonedCell = "true";

                // Insert at the correct position
                const existingCells = htmlRow.querySelectorAll("td, th");
                const referenceCell = existingCells[cloneInfo.cellIndex];
                if (referenceCell) {
                    htmlRow.insertBefore(clonedCell, referenceCell);
                } else {
                    htmlRow.appendChild(clonedCell);
                }
            });
        });

        // Fourth pass: adjust rowSpan for cells in visible rows
        tbodyRows.forEach((row, rowIndex) => {
            if (!matchingRows.has(rowIndex)) {
                return;
            }

            const cells = row.querySelectorAll("td, th");
            cells.forEach((cell) => {
                const htmlCell = cell as HTMLElement;
                // Skip cloned cells - they already have correct rowSpan
                if (htmlCell.dataset.clonedCell) {
                    return;
                }

                const originalRowSpan = parseInt(htmlCell.dataset.originalRowspan || "1", 10);

                if (originalRowSpan > 1) {
                    // Count how many of the spanned rows are actually visible
                    let visibleSpannedRows = 0;
                    for (let i = 0; i < originalRowSpan; i++) {
                        if (matchingRows.has(rowIndex + i)) {
                            visibleSpannedRows++;
                        }
                    }
                    htmlCell.setAttribute("rowspan", String(visibleSpannedRows));

                    // If no visible rows, hide this cell
                    if (visibleSpannedRows === 0) {
                        htmlCell.style.display = "none";
                        htmlCell.dataset.hiddenForClone = "true";
                    }
                }
            });
        });
    }, [containerRef, searchQuery]);
}

/**
 * Basic table component without search functionality.
 * Used when searchable prop is false or not provided.
 */
function BasicTable({ className, sticky, children, ...rest }: Omit<TableProps, "searchable" | "placeholder">) {
    const [isFullScreen, setIsFullScreen] = useState(false);

    if (sticky) {
        return (
            <div className="not-prose">
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
                        <div className="fern-table-root not-prose">
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
                        <div className="fern-table-root not-prose fullscreen">
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

/**
 * Searchable table component with filtering functionality.
 * Used when searchable prop is true.
 */
function SearchableTable({ className, sticky, placeholder, children, ...rest }: Omit<TableProps, "searchable">) {
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
    useTableFilter(tableContainerRef, searchQuery);
    useTableFilter(fullscreenContainerRef, searchQuery);

    const searchInput = (
        <div className="fern-table-search">
            <Search className="fern-table-search-icon" />
            <input
                type="text"
                placeholder={placeholder ?? "Search..."}
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
    );

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
                        <div ref={tableContainerRef} className="fern-table-root not-prose searchable">
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

/**
 * Table component that renders either a basic table or a searchable table
 * based on the searchable prop.
 */
export function Table({ searchable, ...props }: TableProps) {
    if (searchable) {
        return <SearchableTable {...props} />;
    }
    return <BasicTable {...props} />;
}
