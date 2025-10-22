"use client";

import {
    flexRender,
    getCoreRowModel,
    getFilteredRowModel,
    getSortedRowModel,
    useReactTable
} from "@tanstack/react-table";
import { useState } from "react";

import type { FeedbackEntry } from "@/app/actions/getFeedback";
import type { DateRangeOptions } from "@/app/services/posthog/types";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/utils/utils";

import { BORDER_STYLES } from "../analytics/AnalyticsPageClient";
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
}

export function FeedbackTable({ feedback, isLoading, error, dateRange, setDateRange, onRowClick }: FeedbackTableProps) {
    const [isExporting, setIsExporting] = useState(false);

    const table = useReactTable({
        data: feedback,
        columns,
        getCoreRowModel: getCoreRowModel(),
        getSortedRowModel: getSortedRowModel(),
        getFilteredRowModel: getFilteredRowModel()
    });

    const handleExport = () => {
        setIsExporting(true);
        try {
            const allRows = table.getFilteredRowModel().rows;
            const feedbackToExport = allRows.map((row) => row.original);
            exportFeedbackToCSV(feedbackToExport, "feedback-export");
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
                onExport={handleExport}
                isExporting={isExporting}
            />
            <div className="max-h-[600px] min-h-[400px] overflow-y-auto">
                <Table className="table-fixed">
                    <TableHeader>
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
                                    className="cursor-pointer border-none hover:bg-gray-100"
                                    onClick={() => onRowClick(row.original)}
                                >
                                    {row.getVisibleCells().map((cell) => (
                                        <TableCell
                                            key={cell.id}
                                            className={cn(
                                                cell.column.id === "date"
                                                    ? "w-32 px-2"
                                                    : cell.column.id === "wasHelpful"
                                                      ? "w-24"
                                                      : cell.column.id === "location"
                                                        ? "w-48"
                                                        : cell.column.id === "currentUrl"
                                                          ? "pl-0"
                                                          : cell.column.id === "channel"
                                                            ? "w-28"
                                                            : undefined
                                            )}
                                        >
                                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                        </TableCell>
                                    ))}
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
        </div>
    );
}
