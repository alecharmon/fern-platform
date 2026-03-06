"use client";

import {
    flexRender,
    getCoreRowModel,
    getFacetedRowModel,
    getFacetedUniqueValues,
    getFilteredRowModel,
    getSortedRowModel,
    useReactTable
} from "@tanstack/react-table";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useCallback, useState } from "react";

import type { FeedbackEntry, getFeedback } from "@/app/actions/getFeedback";
import type { DateRangeOptions } from "@/app/services/posthog/types";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/utils/utils";

import { BORDER_STYLES } from "../analytics/constants";
import { exportFeedbackToCSV } from "./exportFeedbackToCSV";
import { columns } from "./FeedbackColumnDef";
import { FeedbackTableHeader } from "./FeedbackTableHeader";

interface FeedbackTableProps {
    feedback: FeedbackEntry[];
    isLoading: boolean;
    error: Error | null;
    dateRange: DateRangeOptions;
    setDateRange: (dateRange: DateRangeOptions) => void;
    onRowClick: (feedback: FeedbackEntry) => void;
    pagination: {
        page: number;
        pageSize: number;
        hasMore: boolean;
    };
    onPageChange: (page: number) => void;
    docsUrl: string;
    getFeedbackAction: typeof getFeedback;
}

export function FeedbackTable({
    feedback,
    isLoading,
    error,
    dateRange,
    setDateRange,
    onRowClick,
    pagination,
    onPageChange,
    docsUrl,
    getFeedbackAction
}: FeedbackTableProps) {
    const [isExporting, setIsExporting] = useState(false);

    const handlePreviousPage = useCallback(() => {
        onPageChange(pagination.page - 1);
    }, [onPageChange, pagination.page]);

    const handleNextPage = useCallback(() => {
        onPageChange(pagination.page + 1);
    }, [onPageChange, pagination.page]);

    const table = useReactTable({
        data: feedback,
        columns,
        getCoreRowModel: getCoreRowModel(),
        getSortedRowModel: getSortedRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
        getFacetedRowModel: getFacetedRowModel(),
        getFacetedUniqueValues: getFacetedUniqueValues()
    });

    const handleExport = async () => {
        setIsExporting(true);
        try {
            const allFeedback: FeedbackEntry[] = [];
            let currentPage = 1;
            const pageSize = 1000;
            const maxPages = 100;

            while (currentPage <= maxPages) {
                const response = await getFeedbackAction({
                    docsUrl,
                    dateRange,
                    page: currentPage,
                    pageSize,
                    feedbackType: "page"
                });

                allFeedback.push(...response.feedback);

                if (!response.pagination.hasMore) {
                    break;
                }

                currentPage++;
            }

            const columnFilters = table.getState().columnFilters;
            let filteredFeedback = allFeedback;

            for (const filter of columnFilters) {
                const columnId = filter.id;
                const filterValue = filter.value as string;

                if (!filterValue) {
                    continue;
                }

                filteredFeedback = filteredFeedback.filter((entry) => {
                    if (columnId === "currentUrl") {
                        return entry.currentUrl.toLowerCase().includes(filterValue.toLowerCase());
                    }
                    if (columnId === "wasHelpful") {
                        if (filterValue.toLowerCase() === "true") {
                            return entry.wasHelpful === true;
                        }
                        if (filterValue.toLowerCase() === "false") {
                            return entry.wasHelpful === false;
                        }
                        return true;
                    }
                    if (columnId === "selection") {
                        const cellValue = entry.selection.toLowerCase().replaceAll("-", " ");
                        return cellValue.includes(filterValue.toLowerCase());
                    }
                    if (columnId === "channel") {
                        let channel: string;
                        if (entry.feedbackType === "code_block") {
                            channel = "Code Block";
                        } else {
                            channel = entry.userFeedback?.startsWith("[Ask Fern]") ? "Ask Fern" : "Docs";
                        }
                        return channel.toLowerCase().includes(filterValue.toLowerCase());
                    }
                    if (columnId === "location") {
                        return entry.location.toLowerCase().includes(filterValue.toLowerCase());
                    }
                    if (columnId === "date") {
                        const date = new Date(entry.date);
                        const formattedDate = date.toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric"
                        });
                        return formattedDate.toLowerCase().includes(filterValue.toLowerCase());
                    }
                    return true;
                });
            }

            filteredFeedback.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

            exportFeedbackToCSV(filteredFeedback, "feedback-export");
        } catch (error) {
            console.error("Failed to export CSV:", error);
        } finally {
            setIsExporting(false);
        }
    };

    if (error) {
        return (
            <div
                className={cn(BORDER_STYLES, "border-gray-0 flex h-[400px] w-full items-center justify-center border")}
            >
                <p className="text-red-500">Error loading feedback: {error.message}</p>
            </div>
        );
    }

    return (
        <div className={cn(BORDER_STYLES, "border-gray-0 w-full overflow-hidden border")}>
            <FeedbackTableHeader
                table={table}
                dateRange={dateRange}
                setDateRange={setDateRange}
                onExport={() => void handleExport()}
                isExporting={isExporting}
            />
            <div className="max-h-[600px] min-h-[400px] overflow-y-auto">
                <Table className="table-fixed">
                    <TableHeader className="hidden md:table-header-group">
                        {table.getHeaderGroups().map((headerGroup) => (
                            <TableRow key={headerGroup.id} className="border-none">
                                {headerGroup.headers.map((header) => (
                                    <TableHead
                                        key={header.id}
                                        style={{ fontFamily: "Berkeley Mono, monospace" }}
                                        className={cn(
                                            header.column.id === "date"
                                                ? "w-32 px-2"
                                                : header.column.id === "wasHelpful"
                                                  ? "w-24"
                                                  : header.column.id === "location"
                                                    ? "w-48"
                                                    : header.column.id === "currentUrl"
                                                      ? "pl-0"
                                                      : header.column.id === "channel"
                                                        ? "w-28"
                                                        : undefined
                                        )}
                                    >
                                        {header.isPlaceholder
                                            ? null
                                            : flexRender(header.column.columnDef.header, header.getContext())}
                                    </TableHead>
                                ))}
                            </TableRow>
                        ))}
                    </TableHeader>
                    <TableBody>
                        {isLoading ? (
                            <TableRow>
                                <TableCell colSpan={columns.length} className="h-24 text-center">
                                    Loading...
                                </TableCell>
                            </TableRow>
                        ) : table.getRowModel().rows.length ? (
                            table.getRowModel().rows.map((row) => (
                                <TableRow
                                    key={row.id}
                                    className="cursor-pointer border-none hover:bg-gray-100 py-3 border-b md:border-b-0 last:border-b-0"
                                    onClick={() => onRowClick(row.original)}
                                >
                                    {row.getVisibleCells().map((cell) => {
                                        if (cell.column.id === "currentUrl") {
                                            return (
                                                <TableCell key={cell.id} className="p-2 md:pl-0">
                                                    <div className="md:hidden">
                                                        <div
                                                            className="truncate font-medium"
                                                            style={{ fontFamily: "GT Planar, sans-serif" }}
                                                        >
                                                            {row.original.currentUrl}
                                                        </div>
                                                        <div className="flex flex-wrap items-center gap-2 text-sm text-gray-1000">
                                                            <span>
                                                                {row.original.wasHelpful ? "Helpful" : "Not helpful"}
                                                            </span>
                                                            <span>•</span>
                                                            <span>
                                                                {row.original.selection
                                                                    .replaceAll("-", " ")
                                                                    .charAt(0)
                                                                    .toUpperCase() +
                                                                    row.original.selection
                                                                        .replaceAll("-", " ")
                                                                        .slice(1)
                                                                        .toLowerCase()}
                                                            </span>
                                                            <span>•</span>
                                                            <span>
                                                                {row.original.feedbackType === "code_block"
                                                                    ? "Code Block"
                                                                    : row.original.userFeedback?.startsWith(
                                                                            "[Ask Fern]"
                                                                        )
                                                                      ? "Ask Fern"
                                                                      : "Docs"}
                                                            </span>
                                                            <span>•</span>
                                                            <span>{row.original.location}</span>
                                                            <span>•</span>
                                                            <span>
                                                                {new Date(row.original.date).toLocaleDateString(
                                                                    "en-US",
                                                                    {
                                                                        month: "short",
                                                                        day: "numeric",
                                                                        year: "numeric"
                                                                    }
                                                                )}
                                                            </span>
                                                        </div>
                                                    </div>
                                                    <div className="hidden md:block">
                                                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                                    </div>
                                                </TableCell>
                                            );
                                        }
                                        return (
                                            <TableCell
                                                key={cell.id}
                                                data-desktop-only
                                                className={cn(
                                                    "hidden md:table-cell",
                                                    cell.column.id === "date"
                                                        ? "w-32 px-2"
                                                        : cell.column.id === "wasHelpful"
                                                          ? "w-24"
                                                          : cell.column.id === "location"
                                                            ? "w-48"
                                                            : cell.column.id === "channel"
                                                              ? "w-28"
                                                              : undefined
                                                )}
                                            >
                                                {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                            </TableCell>
                                        );
                                    })}
                                </TableRow>
                            ))
                        ) : (
                            <TableRow>
                                <TableCell colSpan={columns.length} className="h-24 text-center">
                                    No feedback submissions found.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>
            <div className="flex items-center justify-between border-t px-4 py-3">
                <div className="text-sm text-gray-600">
                    Page {pagination.page} • Showing {feedback.length} {feedback.length === 1 ? "entry" : "entries"}
                </div>
                <div className="flex gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handlePreviousPage}
                        disabled={pagination.page === 1 || isLoading}
                    >
                        <ChevronLeft className="h-4 w-4 mr-1" />
                        Previous
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handleNextPage}
                        disabled={!pagination.hasMore || isLoading}
                    >
                        Next
                        <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                </div>
            </div>
        </div>
    );
}
