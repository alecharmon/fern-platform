"use client";

import type { ActivityLogType } from "@fern-platform/activity-log";
import { useQuery } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { ArrowUpRight } from "lucide-react";
import { useMemo } from "react";

import { type CreditUsageRow, getAiCreditUsageAction } from "@/app/actions/getAiCreditUsage";
import type { Auth0OrgName } from "@/app/services/auth0/types";
import Card from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table/data-table";
import { Note } from "@/components/ui/Note";

const TYPE_LABELS: Record<ActivityLogType, string> = {
    ask_fern: "Ask Fern",
    fern_writer: "Writer"
};

const TYPE_COLORS: Record<ActivityLogType, string> = {
    ask_fern: "bg-green-600",
    fern_writer: "bg-blue-600"
};

function formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric"
    });
}

function formatDateRange(since: string, until: string): string {
    const start = new Date(since).toLocaleDateString("en-US", {
        month: "short",
        day: "2-digit",
        year: "numeric"
    });
    const end = new Date(until).toLocaleDateString("en-US", {
        month: "short",
        day: "2-digit",
        year: "numeric"
    });
    return `${start} to ${end}`;
}

function buildColumns(): ColumnDef<CreditUsageRow, unknown>[] {
    return [
        {
            accessorKey: "description",
            header: "Description",
            enableColumnFilter: false,
            enableSorting: false,
            cell: ({ row }) => <span className="truncate text-sm">{row.original.description}</span>
        },
        {
            accessorKey: "docsSite",
            header: "Docs site",
            enableColumnFilter: true,
            enableSorting: true,
            meta: { width: 200 },
            cell: ({ row }) => <span className="truncate text-sm text-muted-foreground">{row.original.docsSite}</span>
        },
        {
            accessorKey: "type",
            header: "Type",
            enableColumnFilter: true,
            enableSorting: true,
            meta: { width: 160 },
            cell: ({ row }) => {
                const type = row.original.type;
                return (
                    <div className="flex items-center gap-2 text-sm">
                        <span className={`size-2.5 rounded-full ${TYPE_COLORS[type]}`} />
                        <span>{TYPE_LABELS[type]}</span>
                    </div>
                );
            }
        },
        {
            accessorKey: "date",
            header: "Date",
            enableColumnFilter: false,
            enableSorting: true,
            meta: { width: 140 },
            cell: ({ row }) => <span className="text-sm text-muted-foreground">{formatDate(row.original.date)}</span>
        },
        {
            accessorKey: "creditsUsed",
            header: "Credits used",
            enableColumnFilter: false,
            enableSorting: true,
            meta: { width: 120 },
            cell: ({ row }) => <span className="text-sm">{row.original.creditsUsed}</span>
        },
        {
            id: "actions",
            header: "",
            enableColumnFilter: false,
            enableSorting: false,
            meta: { width: 100 },
            cell: ({ row }) => {
                const prUrls = row.original.prUrls;
                if (!prUrls?.length) {
                    return null;
                }
                return (
                    <a
                        href={prUrls[0]}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-sm font-medium text-green-900 hover:text-green-1100"
                    >
                        View PR
                        <ArrowUpRight className="size-3.5" />
                    </a>
                );
            }
        }
    ];
}

export declare namespace AiCreditUsagePage {
    export interface Props {
        orgName: Auth0OrgName;
    }
}

export function AiCreditUsagePage({ orgName }: AiCreditUsagePage.Props) {
    const { data: result, isLoading } = useQuery({
        queryKey: ["ai-credit-usage", orgName],
        queryFn: () => getAiCreditUsageAction(orgName)
    });

    const usageData = result && "data" in result ? result.data : undefined;
    const columns = useMemo(() => buildColumns(), []);
    const rows = usageData?.rows ?? [];
    const isExhausted = usageData != null && usageData.availableCredits === 0;

    return (
        <div className="flex w-full max-w-5xl flex-col gap-6 px-6 py-8">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold">AI Credit Usage</h1>
            </div>

            {isExhausted && (
                <Note
                    variant="error"
                    title="You've reached your AI credit limit"
                    subtitle="AI services are paused. Purchase additional AI credits or wait until your next monthly billing period."
                />
            )}

            <div className="grid grid-cols-3 gap-4">
                <Card>
                    <div className="flex flex-col gap-1">
                        <span className="text-sm text-muted-foreground">Current billing cycle</span>
                        <span className="text-lg font-semibold">
                            {usageData
                                ? formatDateRange(usageData.billingPeriod.since, usageData.billingPeriod.until)
                                : "—"}
                        </span>
                    </div>
                </Card>
                <Card>
                    <div className="flex flex-col gap-1">
                        <span className="text-sm text-muted-foreground">Total used in this cycle</span>
                        <div className="flex items-baseline gap-1.5">
                            <span className="text-lg font-semibold">{usageData?.totalUsed ?? "—"}</span>
                            <span className="text-sm text-muted-foreground">credits</span>
                        </div>
                    </div>
                </Card>
                <Card>
                    <div className="flex flex-col gap-1">
                        <span className="text-sm text-muted-foreground">Available credits</span>
                        <div className="flex items-baseline gap-1.5">
                            <span className="text-lg font-semibold">{usageData?.availableCredits ?? "—"}</span>
                            <span className="text-sm text-muted-foreground">credits</span>
                        </div>
                    </div>
                </Card>
            </div>

            <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-1">
                    <h2 className="text-lg font-semibold">Usage history</h2>
                    <p className="text-sm text-muted-foreground">View detailed usage information for each session</p>
                </div>

                <DataTable
                    columns={columns}
                    data={rows}
                    initialPageSize={10}
                    className="overflow-hidden rounded-xl border border-border"
                >
                    <DataTable.Content className="[&_thead_tr_th]:border-b [&_thead_tr_th]:border-border [&_tbody_tr:not(:last-child)_td]:border-b [&_tbody_tr:not(:last-child)_td]:border-border">
                        <DataTable.Header className="[&_th]:font-normal [&_th]:text-muted-foreground" />
                        <DataTable.Body
                            loading={isLoading}
                            emptyState={<span className="text-muted-foreground">No usage history found.</span>}
                        />
                    </DataTable.Content>
                    <DataTable.Pagination />
                </DataTable>
            </div>
        </div>
    );
}
