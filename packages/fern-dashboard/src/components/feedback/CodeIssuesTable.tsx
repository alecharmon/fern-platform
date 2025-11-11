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
import { useState } from "react";

import type { FeedbackEntry } from "@/app/actions/getFeedback";
import type { DateRangeOptions } from "@/app/services/posthog/types";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/utils/utils";

import { BORDER_STYLES } from "../analytics/AnalyticsPageClient";
import { codeIssuesColumns } from "./CodeIssuesColumnDef";
import { exportFeedbackToCSV } from "./exportFeedbackToCSV";
import { FeedbackTableHeader } from "./FeedbackTableHeader";

interface CodeIssuesTableProps {
    codeIssues: FeedbackEntry[];
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
}

export function CodeIssuesTable({
    codeIssues,
    isLoading,
    error,
    dateRange,
    setDateRange,
    onRowClick,
    pagination,
    onPageChange
}: CodeIssuesTableProps) {
    const [isExporting, setIsExporting] = useState(false);

    const table = useReactTable({
        data: codeIssues,
        columns: codeIssuesColumns,
        getCoreRowModel: getCoreRowModel(),
        getSortedRowModel: getSortedRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
        getFacetedRowModel: getFacetedRowModel(),
        getFacetedUniqueValues: getFacetedUniqueValues()
    });

    const handleExport = () => {
        setIsExporting(true);
        try {
            const allRows = table.getFilteredRowModel().rows;
            const feedbackToExport = allRows.map((row) => row.original);
            exportFeedbackToCSV(feedbackToExport, "code-issues-export");
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
                <p className="text-red-500">Error loading code issues: {error.message}</p>
            </div>
        );
    }

    return (
        <div className={cn(BORDER_STYLES, "border-gray-0 w-full overflow-hidden border")}>
            <FeedbackTableHeader
                table={table}
                title="Code Issues"
                dateRange={dateRange}
                setDateRange={setDateRange}
                onExport={handleExport}
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
                                                : header.column.id === "language"
                                                  ? "w-32"
                                                  : header.column.id === "location"
                                                    ? "w-48"
                                                    : header.column.id === "currentUrl"
                                                      ? "pl-0"
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
                                <TableCell colSpan={codeIssuesColumns.length} className="h-24 text-center">
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
                                                            <span>{row.original.language || "Unknown"}</span>
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
                                                        : cell.column.id === "language"
                                                          ? "w-32"
                                                          : cell.column.id === "location"
                                                            ? "w-48"
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
                                <TableCell colSpan={codeIssuesColumns.length} className="h-24 text-center">
                                    No code issues found.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>
            <div className="flex items-center justify-between border-t px-4 py-3">
                <div className="text-sm text-gray-600">
                    Page {pagination.page} • Showing {codeIssues.length} {codeIssues.length === 1 ? "issue" : "issues"}
                </div>
                <div className="flex gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onPageChange(pagination.page - 1)}
                        disabled={pagination.page === 1 || isLoading}
                    >
                        <ChevronLeft className="h-4 w-4 mr-1" />
                        Previous
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onPageChange(pagination.page + 1)}
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
