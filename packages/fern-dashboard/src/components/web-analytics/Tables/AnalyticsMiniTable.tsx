"use client";

import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { useMemo, useState } from "react";

import { DashboardTooltip } from "@/components/editor/DashboardTooltip";

const COLOR_MAP = {
    red: "239 68 68", // #EF4444
    green: "34 197 94", // #22C55E
    yellow: "255 186 24", // #FFBA18
    blue: "1 144 255" // #0190FF
} as const;

interface AnalyticsMiniTableProps<T extends Record<string, any>> {
    title: string;
    data: T[] | undefined;
    isLoading: boolean;
    error: Error | null;
    columns: {
        key: string;
        label: string;
        width?: string;
        sortable?: boolean;
        format?: (value: any) => string;
        render?: (item: T, index: number) => React.ReactNode;
    }[];
    getItemKey: (item: T) => string;
    showGradient?: boolean;
    gradientKey?: string;
    barVariant?: "green" | "red" | "yellow" | "blue";
    onSort?: (field: string, direction: "asc" | "desc") => void;
    maxLength?: number;
    defaultSortField?: string | null;
}

type SortDirection = "asc" | "desc";

function TruncatedText({ text, className, maxLength = 45 }: { text: string; className?: string; maxLength?: number }) {
    const needsTooltip = text.length > maxLength;

    if (!needsTooltip) {
        return <span className={className}>{text}</span>;
    }

    const truncatedText = text.slice(0, maxLength) + "...";

    return (
        <DashboardTooltip content={text} delayDuration={500}>
            <span className={className}>{truncatedText}</span>
        </DashboardTooltip>
    );
}

export default function AnalyticsMiniTable<T extends Record<string, any>>({
    title,
    data,
    isLoading,
    error,
    columns,
    getItemKey,
    showGradient = false,
    gradientKey = "visitors",
    barVariant = "green",
    onSort,
    maxLength = 45,
    defaultSortField = null
}: AnalyticsMiniTableProps<T>) {
    const [sortField, setSortField] = useState<string | null>(defaultSortField);
    const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
    const sortedData = useMemo(() => {
        if (!data || !sortField) {
            return data || [];
        }

        return [...data].sort((a, b) => {
            const aValue = a[sortField];
            const bValue = b[sortField];

            if (sortDirection === "asc") {
                return aValue - bValue;
            } else {
                return bValue - aValue;
            }
        });
    }, [data, sortField, sortDirection]);

    const handleSort = (field: string) => {
        let newDirection: SortDirection;
        if (sortField === field) {
            newDirection = sortDirection === "asc" ? "desc" : "asc";
            setSortDirection(newDirection);
        } else {
            setSortField(field);
            newDirection = "desc";
            setSortDirection(newDirection);
        }
        // Notify parent component of sort change
        if (onSort) {
            onSort(field, newDirection);
        }
    };

    const getSortIcon = (field: string) => {
        if (sortField !== field) {
            return <ArrowUpDown className="h-3 w-3 opacity-50" />;
        }
        return sortDirection === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />;
    };

    if (error) {
        return (
            <div className="border-border flex w-full flex-col gap-3 rounded-lg border bg-white p-6 lg:w-[49%] dark:bg-transparent">
                <span className="text-destructive text-sm">Error loading {title.toLowerCase()}</span>
            </div>
        );
    }

    const maxGradientValue = showGradient && data ? Math.max(...data.map((item) => item[gradientKey] || 0)) : 1;

    return (
        <div className="border-border flex w-full flex-col gap-3 rounded-lg border bg-white lg:w-[49%] dark:bg-transparent">
            <div className="space-y-1">
                {/* Header */}
                <div className="flex justify-between border-b px-4 py-4">
                    <span className="flex-1">{title}</span>
                    {columns.slice(1).map((column) =>
                        column.sortable ? (
                            <button
                                key={column.key}
                                onClick={() => handleSort(column.key)}
                                className="text-muted-foreground hover:text-foreground flex cursor-pointer items-center justify-end gap-1 font-mono text-sm transition-colors"
                                style={{ width: column.width || "90px" }}
                                disabled={isLoading}
                            >
                                {column.label}
                                {getSortIcon(column.key)}
                            </button>
                        ) : (
                            <span
                                key={column.key}
                                className="text-muted-foreground flex items-center justify-end gap-1 font-mono text-sm"
                                style={{ width: column.width || "90px" }}
                            >
                                {column.label}
                            </span>
                        )
                    )}
                </div>

                {/* Rows */}
                {isLoading ? (
                    <div className="space-y-3 p-6">
                        {Array.from({ length: 10 }).map((_, i) => (
                            <div key={i} className="flex items-center justify-between">
                                <div className="h-5 w-48 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
                                <div className="flex gap-8">
                                    <div className="h-5 w-16 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
                                    <div className="h-5 w-16 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="px-4 pb-2">
                        {sortedData.length > 0 ? (
                            sortedData.map((item, index) => {
                                const percentage = showGradient
                                    ? Math.max(7, (item[gradientKey] / maxGradientValue) * 100)
                                    : 0;

                                // Support per-row barVariant if present in the data
                                const rowBarVariant =
                                    "barVariant" in item
                                        ? (item.barVariant as "green" | "red" | "yellow" | "blue")
                                        : barVariant;

                                return (
                                    <div
                                        key={getItemKey(item)}
                                        className="group relative flex items-center justify-between rounded py-2 transition-colors hover:bg-gray-50/50 dark:hover:bg-gray-800/30"
                                    >
                                        {/* First column with optional gradient */}
                                        <span className="relative flex-1 truncate font-mono text-sm">
                                            {showGradient && (
                                                <span
                                                    className="absolute inset-y-0 left-0"
                                                    style={{
                                                        width: `${percentage}%`,
                                                        borderRadius: "4px",
                                                        pointerEvents: "none",
                                                        background: `linear-gradient(to right,
                                                            transparent 0%,
                                                            rgb(${COLOR_MAP[rowBarVariant]} / 0.1) 30%,
                                                            rgb(${COLOR_MAP[rowBarVariant]} / 0.25) 50%,
                                                            rgb(${COLOR_MAP[rowBarVariant]} / 0.35) 60%,
                                                            rgb(${COLOR_MAP[rowBarVariant]} / 0.35) 70%,
                                                            rgb(${COLOR_MAP[rowBarVariant]} / 0.5) 80%)`
                                                    }}
                                                />
                                            )}
                                            <span className="z-10 flex h-[30px] items-center px-2">
                                                {columns[0]?.render ? (
                                                    columns[0].render(item, index)
                                                ) : (
                                                    <TruncatedText
                                                        text={String(item[columns[0]?.key || ""])}
                                                        className="flex items-center truncate"
                                                        maxLength={maxLength}
                                                    />
                                                )}
                                            </span>
                                        </span>

                                        {/* Other columns */}
                                        {columns.slice(1).map((column) => (
                                            <span
                                                key={column.key}
                                                className="text-sm tabular-nums"
                                                style={{
                                                    width: column.width || "90px",
                                                    textAlign: "right"
                                                }}
                                            >
                                                {column.format ? column.format(item[column.key]) : item[column.key]}
                                            </span>
                                        ))}
                                    </div>
                                );
                            })
                        ) : (
                            <div className="text-muted-foreground py-8 text-center text-sm">
                                No data available for the selected period
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
