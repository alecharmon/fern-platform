"use client";

import type { Table } from "@tanstack/react-table";
import { MessageSquareIcon } from "lucide-react";

import type { FeedbackEntry } from "@/app/actions/getFeedback";
import type { DateRangeOptions } from "@/app/services/posthog/types";

import { ExportButton } from "../analytics/ExportButton";
import SelectDate from "../web-analytics/SelectDate";

interface FeedbackTableHeaderProps {
    table?: Table<FeedbackEntry> | null;
    title?: string;
    rowCount?: number;
    dateRange: DateRangeOptions;
    setDateRange: (dateRange: DateRangeOptions) => void;
    onExport: () => void;
    isExporting?: boolean;
}

export function FeedbackTableHeader({
    table,
    title = "All Feedback",
    rowCount,
    dateRange,
    setDateRange,
    onExport,
    isExporting
}: FeedbackTableHeaderProps) {
    const disabledExport = (rowCount ?? table?.getFilteredRowModel().rows.length ?? 0) === 0;

    return (
        <div className="mb-4 flex w-full flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-2">
                <MessageSquareIcon className="h-4 w-4" />
                <span>{title}</span>
            </div>
            <div className="flex items-center gap-2">
                <ExportButton onClick={onExport} isLoading={isExporting} disabled={disabledExport} />
                <SelectDate value={dateRange} onChange={setDateRange} />
            </div>
        </div>
    );
}
