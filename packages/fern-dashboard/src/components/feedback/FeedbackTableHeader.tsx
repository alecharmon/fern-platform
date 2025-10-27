"use client";

import type { Table } from "@tanstack/react-table";
import { MessageSquareIcon } from "lucide-react";

import type { FeedbackEntry } from "@/app/actions/getFeedback";
import type { DateRangeOptions } from "@/app/services/posthog/types";

import { ExportButton } from "../analytics/ExportButton";
import SelectDate from "../web-analytics/SelectDate";

interface FeedbackTableHeaderProps {
    table: Table<FeedbackEntry>;
    dateRange: DateRangeOptions;
    setDateRange: (dateRange: DateRangeOptions) => void;
    onExport: () => void;
    isExporting?: boolean;
}

export function FeedbackTableHeader({
    table,
    dateRange,
    setDateRange,
    onExport,
    isExporting
}: FeedbackTableHeaderProps) {
    return (
        <div className="mb-4 flex w-full flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-2">
                <MessageSquareIcon className="h-4 w-4" />
                <span>All Feedback</span>
            </div>
            <div className="flex items-center gap-2">
                <ExportButton
                    onClick={onExport}
                    isLoading={isExporting}
                    disabled={table.getFilteredRowModel().rows.length === 0}
                />
                <SelectDate value={dateRange} onChange={setDateRange} />
            </div>
        </div>
    );
}
