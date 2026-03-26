"use client";

import type {
    ColumnDef,
    ColumnFiltersState,
    OnChangeFn,
    PaginationState,
    SortingState,
    TableOptions,
    Table as TanstackTable
} from "@tanstack/react-table";
import {
    flexRender,
    getCoreRowModel,
    getFacetedRowModel,
    getFacetedUniqueValues,
    getFilteredRowModel,
    getPaginationRowModel,
    getSortedRowModel,
    useReactTable
} from "@tanstack/react-table";
import {
    ArrowDown,
    ArrowUp,
    ArrowUpDown,
    ChevronLeft,
    ChevronRight,
    ListFilter,
    MoreHorizontal,
    Search,
    X
} from "lucide-react";
import type { ReactNode } from "react";
import { createContext, useContext, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/utils/utils";

// ------------------------------------------------------------------
// Context
// ------------------------------------------------------------------

interface DataTableContextValue<TData> {
    table: TanstackTable<TData>;
    columns: ColumnDef<TData, unknown>[];
}

const DataTableContext = createContext<DataTableContextValue<unknown> | null>(null);

function useDataTable<TData>() {
    const ctx = useContext(DataTableContext) as DataTableContextValue<TData> | null;
    if (!ctx) {
        throw new Error("DataTable compound components must be used within <DataTable>");
    }
    return ctx;
}

// ------------------------------------------------------------------
// Root
// ------------------------------------------------------------------

interface DataTableProps<TData> {
    columns: ColumnDef<TData, unknown>[];
    data: TData[];
    children: ReactNode;
    className?: string;

    // Server-side / manual mode
    manualPagination?: boolean;
    manualSorting?: boolean;
    manualFiltering?: boolean;
    pageCount?: number;
    rowCount?: number;

    // Controlled state callbacks
    onPaginationChange?: OnChangeFn<PaginationState>;
    onSortingChange?: OnChangeFn<SortingState>;
    onColumnFiltersChange?: OnChangeFn<ColumnFiltersState>;
    onGlobalFilterChange?: OnChangeFn<string>;

    // Initial state
    initialPageSize?: number;
}

function DataTableRoot<TData>({
    columns,
    data,
    children,
    className,
    manualPagination,
    manualSorting,
    manualFiltering,
    pageCount,
    rowCount,
    onPaginationChange,
    onSortingChange,
    onColumnFiltersChange,
    onGlobalFilterChange,
    initialPageSize = 10
}: DataTableProps<TData>) {
    const [sorting, setSorting] = useState<SortingState>([]);
    const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
    const [globalFilter, setGlobalFilter] = useState<string>("");
    const [pagination, setPagination] = useState<PaginationState>({
        pageIndex: 0,
        pageSize: initialPageSize
    });

    const tableOptions: TableOptions<TData> = {
        data,
        columns,
        state: {
            sorting,
            columnFilters,
            globalFilter,
            pagination
        },
        onSortingChange: (updater) => {
            setSorting(updater);
            onSortingChange?.(updater);
        },
        onColumnFiltersChange: (updater) => {
            setColumnFilters(updater);
            onColumnFiltersChange?.(updater);
        },
        onGlobalFilterChange: (updater) => {
            setGlobalFilter(updater);
            onGlobalFilterChange?.(updater);
        },
        onPaginationChange: (updater) => {
            setPagination(updater);
            onPaginationChange?.(updater);
        },
        getCoreRowModel: getCoreRowModel(),
        ...(manualSorting ? { manualSorting: true } : { getSortedRowModel: getSortedRowModel() }),
        ...(manualFiltering
            ? { manualFiltering: true }
            : {
                  getFilteredRowModel: getFilteredRowModel(),
                  getFacetedRowModel: getFacetedRowModel(),
                  getFacetedUniqueValues: getFacetedUniqueValues()
              }),
        ...(manualPagination
            ? { manualPagination: true, pageCount }
            : { getPaginationRowModel: getPaginationRowModel() }),
        ...(rowCount !== undefined ? { rowCount } : {})
    };

    const table = useReactTable(tableOptions);

    // Do NOT memoize: useReactTable returns a stable reference, so useMemo deps
    // would never change, preventing context consumers from re-rendering on state updates.
    const contextValue = { table, columns } as DataTableContextValue<unknown>;

    return (
        <DataTableContext.Provider value={contextValue}>
            <div data-slot="data-table" className={cn("w-full", className)}>
                {children}
            </div>
        </DataTableContext.Provider>
    );
}

// ------------------------------------------------------------------
// Header
// ------------------------------------------------------------------

function DataTableContent({
    children,
    className,
    loading
}: {
    children: ReactNode;
    className?: string;
    loading?: boolean;
}) {
    return (
        <div className="relative">
            <Table className={className}>{children}</Table>
            {loading && (
                <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/60">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                        <span>Loading...</span>
                    </div>
                </div>
            )}
        </div>
    );
}

function DataTableHeader({ className }: { className?: string }) {
    const { table } = useDataTable();

    return (
        <TableHeader className={className}>
            {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id} className="border-none">
                    {headerGroup.headers.map((header) => {
                        const width = (header.column.columnDef.meta as { width?: number } | undefined)?.width;
                        return (
                            <TableHead
                                key={header.id}
                                className={cn(!width && "w-auto")}
                                style={width ? { width, minWidth: width } : undefined}
                            >
                                {header.isPlaceholder ? null : (
                                    <div className="flex items-center justify-between gap-2">
                                        <span className="flex-1 truncate">
                                            {flexRender(header.column.columnDef.header, header.getContext())}
                                        </span>
                                        {(header.column.getCanFilter() || header.column.getCanSort()) && (
                                            <span className="flex shrink-0 items-center gap-1">
                                                {header.column.getCanFilter() && (
                                                    <DataTableColumnFilter column={header.column} />
                                                )}
                                                {header.column.getCanSort() &&
                                                    (() => {
                                                        const sorted = header.column.getIsSorted();
                                                        return (
                                                            <button
                                                                type="button"
                                                                className={cn(
                                                                    "text-muted-foreground hover:text-foreground transition-colors",
                                                                    sorted && "text-primary"
                                                                )}
                                                                onClick={header.column.getToggleSortingHandler()}
                                                            >
                                                                {sorted === "asc" ? (
                                                                    <ArrowUp className="h-4 w-4" />
                                                                ) : sorted === "desc" ? (
                                                                    <ArrowDown className="h-4 w-4" />
                                                                ) : (
                                                                    <ArrowUpDown className="h-4 w-4" />
                                                                )}
                                                            </button>
                                                        );
                                                    })()}
                                            </span>
                                        )}
                                    </div>
                                )}
                            </TableHead>
                        );
                    })}
                </TableRow>
            ))}
        </TableHeader>
    );
}

// ------------------------------------------------------------------
// Body
// ------------------------------------------------------------------

// Override the base TableRow's first/last cell padding removal so cells align with headers
const DATA_TABLE_ROW_CLASSES =
    "md:[&>td:first-child]:pl-2 md:[&>td:last-child]:pr-2 md:hover:[&>td:first-child]:pl-2 md:hover:[&>td:last-child]:pr-2";

interface DataTableBodyProps {
    className?: string;
    emptyState?: ReactNode;
    loading?: boolean;
    /** Number of skeleton rows to show when loading with no data. Defaults to 5. */
    skeletonRows?: number;
    onRowClick?: (row: unknown) => void;
}

function DataTableBody({ className, emptyState, loading, skeletonRows = 5, onRowClick }: DataTableBodyProps) {
    const { table, columns } = useDataTable();
    const hasRows = table.getRowModel().rows.length > 0;

    return (
        <TableBody className={className}>
            {loading && !hasRows ? (
                Array.from({ length: skeletonRows }).map((_, i) => (
                    <TableRow key={`skeleton-${i}`} className={DATA_TABLE_ROW_CLASSES}>
                        {columns.map((col, j) => {
                            const width = (col.meta as { width?: number } | undefined)?.width;
                            return (
                                <TableCell
                                    key={`skeleton-${i}-${j}`}
                                    style={width ? { width, minWidth: width } : undefined}
                                >
                                    <Skeleton className="h-4 w-full" />
                                </TableCell>
                            );
                        })}
                    </TableRow>
                ))
            ) : hasRows ? (
                table.getRowModel().rows.map((row) => (
                    <TableRow
                        key={row.id}
                        data-state={row.getIsSelected() ? "selected" : undefined}
                        className={cn(DATA_TABLE_ROW_CLASSES, onRowClick && "cursor-pointer")}
                        onClick={onRowClick ? () => onRowClick(row.original) : undefined}
                    >
                        {row.getVisibleCells().map((cell) => {
                            const width = (cell.column.columnDef.meta as { width?: number } | undefined)?.width;
                            return (
                                <TableCell key={cell.id} style={width ? { width, minWidth: width } : undefined}>
                                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                </TableCell>
                            );
                        })}
                    </TableRow>
                ))
            ) : (
                <TableRow className={DATA_TABLE_ROW_CLASSES}>
                    <TableCell colSpan={columns.length} className="h-24 text-center">
                        {emptyState ?? "No results."}
                    </TableCell>
                </TableRow>
            )}
        </TableBody>
    );
}

// ------------------------------------------------------------------
// Toolbar
// ------------------------------------------------------------------

function DataTableToolbar({ children, className }: { children: ReactNode; className?: string }) {
    return (
        <div
            data-slot="data-table-toolbar"
            className={cn("flex items-center justify-between border-b border-border px-2 py-3", className)}
        >
            {children}
        </div>
    );
}

// ------------------------------------------------------------------
// Search Bar
// ------------------------------------------------------------------

function DataTableSearchBar({ placeholder = "Search...", className }: { placeholder?: string; className?: string }) {
    const { table } = useDataTable();
    const value = (table.getState().globalFilter as string) ?? "";

    return (
        <div className={cn("relative", className)}>
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
                placeholder={placeholder}
                value={value}
                onChange={(e) => table.setGlobalFilter(e.target.value)}
                className="pl-8"
            />
        </div>
    );
}

// ------------------------------------------------------------------
// Column Filter (used internally by Header, but also exported)
// ------------------------------------------------------------------

function DataTableColumnFilter<TData, TValue>({
    column
}: {
    column: import("@tanstack/react-table").Column<TData, TValue>;
}) {
    const [isOpen, setIsOpen] = useState(false);
    const [searchValue, setSearchValue] = useState<string>("");
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isOpen && inputRef.current) {
            inputRef.current.focus();
        }
    }, [isOpen]);

    const facetedValues = column.getFacetedUniqueValues();
    const uniqueValues: string[] = [];
    facetedValues.forEach((_count, value) => {
        uniqueValues.push(String(value));
    });
    uniqueValues.sort();

    const filteredValues = (() => {
        if (!searchValue) {
            return uniqueValues;
        }
        const searchLower = searchValue.toLowerCase();
        return uniqueValues.filter((v) => v.toLowerCase().includes(searchLower));
    })();

    const selectedValue = (column.getFilterValue() as string) ?? "";

    const handleSearchChange = (value: string) => {
        setSearchValue(value);
    };

    const handleSelectValue = (value: string) => {
        column.setFilterValue(value);
        setSearchValue("");
        setIsOpen(false);
    };

    const handleClear = () => {
        setSearchValue("");
        column.setFilterValue(undefined);
        setIsOpen(false);
    };

    const isFiltered = column.getFilterValue() !== undefined;

    return (
        <Popover open={isOpen} onOpenChange={setIsOpen}>
            <PopoverTrigger asChild>
                <button
                    type="button"
                    className={cn(
                        "text-muted-foreground hover:text-foreground transition-colors",
                        isFiltered && "text-primary"
                    )}
                >
                    <ListFilter className="h-4 w-4" />
                </button>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-3" align="start">
                <div className="space-y-2">
                    <div className="text-sm font-medium">Filter</div>
                    <div className="relative">
                        <Input
                            ref={inputRef}
                            placeholder="Search..."
                            value={searchValue}
                            onChange={(e) => handleSearchChange(e.target.value)}
                            className="pr-8"
                        />
                        {searchValue && (
                            <Button
                                variant="ghost"
                                size="sm"
                                className="absolute right-1 top-1/2 h-6 w-6 -translate-y-1/2 p-0"
                                onClick={() => setSearchValue("")}
                            >
                                <X className="h-3 w-3" />
                            </Button>
                        )}
                    </div>
                    {filteredValues.length > 0 && (
                        <div className="max-h-48 overflow-y-auto rounded-md border">
                            {filteredValues.map((value) => (
                                <button
                                    key={value}
                                    type="button"
                                    onClick={() => handleSelectValue(value)}
                                    className={cn(
                                        "w-full px-3 py-2 text-left text-sm transition-colors hover:bg-accent",
                                        selectedValue === value && "bg-accent font-medium"
                                    )}
                                >
                                    <span className="block truncate">{value}</span>
                                </button>
                            ))}
                        </div>
                    )}
                    {isFiltered && (
                        <Button variant="outline" size="sm" onClick={handleClear} className="w-full">
                            Clear filter
                        </Button>
                    )}
                </div>
            </PopoverContent>
        </Popover>
    );
}

// ------------------------------------------------------------------
// Pagination
// ------------------------------------------------------------------

function generatePageNumbers(currentPage: number, totalPages: number, maxVisible: number): (number | "ellipsis")[] {
    const pages: (number | "ellipsis")[] = [];
    const clamped = Math.max(2, Math.floor(maxVisible));

    if (totalPages <= clamped) {
        return Array.from({ length: totalPages }, (_, i) => i + 1);
    }

    const windowSize = clamped - 2;
    let start = Math.max(2, currentPage - Math.floor(windowSize / 2));
    const end = Math.min(totalPages - 1, start + windowSize - 1);
    start = Math.max(2, end - windowSize + 1);

    pages.push(1);
    if (start > 2) {
        pages.push("ellipsis");
    }
    for (let i = start; i <= end; i++) {
        pages.push(i);
    }
    if (end < totalPages - 1) {
        pages.push("ellipsis");
    }
    pages.push(totalPages);

    return pages;
}

interface DataTablePaginationProps {
    className?: string;
    /** Max visible page buttons. Defaults to 7. */
    maxVisiblePages?: number;
}

function DataTablePagination({ className, maxVisiblePages = 7 }: DataTablePaginationProps) {
    const { table } = useDataTable();

    const pageCount = table.getPageCount();
    const currentPageIndex = table.getState().pagination.pageIndex;
    const currentPage = currentPageIndex + 1;

    const canPrevious = table.getCanPreviousPage();
    const canNext = table.getCanNextPage();

    // If pageCount is unknown or <= 0, fall back to simple prev/next
    const showPageNumbers = pageCount > 0;

    const pages = showPageNumbers ? generatePageNumbers(currentPage, pageCount, maxVisiblePages) : [];

    return (
        <nav
            role="navigation"
            aria-label="pagination"
            data-slot="data-table-pagination"
            className={cn("flex w-full items-center justify-center py-3", className)}
        >
            <ul className="flex items-center gap-1">
                <li>
                    <Button
                        variant="ghost"
                        size="sm"
                        className={cn("gap-1", !canPrevious && "opacity-50")}
                        disabled={!canPrevious}
                        onClick={() => table.previousPage()}
                        aria-label="Go to previous page"
                    >
                        <ChevronLeft className="h-4 w-4" />
                        <span>Previous</span>
                    </Button>
                </li>

                {pages.map((page, idx) => (
                    <li key={page === "ellipsis" ? `ellipsis-${idx}` : page}>
                        {page === "ellipsis" ? (
                            <span className="flex h-8 w-8 items-center justify-center" aria-hidden>
                                <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
                            </span>
                        ) : (
                            <Button
                                variant={currentPage === page ? "default" : "ghost"}
                                size="icon"
                                className={cn(
                                    "h-8 w-8",
                                    currentPage === page && "bg-primary text-primary-foreground hover:bg-primary/90"
                                )}
                                onClick={() => table.setPageIndex(page - 1)}
                                aria-current={currentPage === page ? "page" : undefined}
                            >
                                {page}
                            </Button>
                        )}
                    </li>
                ))}

                <li>
                    <Button
                        variant="ghost"
                        size="sm"
                        className={cn("gap-1", !canNext && "opacity-50")}
                        disabled={!canNext}
                        onClick={() => table.nextPage()}
                        aria-label="Go to next page"
                    >
                        <span>Next</span>
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                </li>
            </ul>
        </nav>
    );
}

// ------------------------------------------------------------------
// Compound export
// ------------------------------------------------------------------

const DataTable = Object.assign(DataTableRoot, {
    Content: DataTableContent,
    Header: DataTableHeader,
    Body: DataTableBody,
    Toolbar: DataTableToolbar,
    SearchBar: DataTableSearchBar,
    Pagination: DataTablePagination,
    ColumnFilter: DataTableColumnFilter
});

export { DataTable, useDataTable };
export type { DataTableProps };
