"use client";

import type { Table } from "@tanstack/react-table";
import { MessageSquareIcon } from "lucide-react";

import type { FeedbackEntry } from "@/app/actions/getFeedback";
import type { DateRangeOptions } from "@/app/services/posthog/types";

import SelectDate from "../web-analytics/SelectDate";

interface FeedbackTableHeaderProps {
    table: Table<FeedbackEntry>;
    dateRange: DateRangeOptions;
    setDateRange: (dateRange: DateRangeOptions) => void;
}

export function FeedbackTableHeader({ table, dateRange, setDateRange }: FeedbackTableHeaderProps) {
    return (
        <div className="mb-4 flex w-full items-center justify-between gap-2">
            <div className="flex items-center gap-2">
                <MessageSquareIcon className="h-4 w-4" />
                <span>All Feedback</span>
            </div>
            <SelectDate value={dateRange} onChange={setDateRange} />
        </div>
    );
}
