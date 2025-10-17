"use client";

import type { FernAI } from "@fern-api/fai-sdk";
import {
    type Cell,
    type ColumnDef,
    flexRender,
    getCoreRowModel,
    getFilteredRowModel,
    getSortedRowModel,
    type Row,
    useReactTable
} from "@tanstack/react-table";

import { getConversation } from "@/app/actions/getConversation";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

import { QueriesDataTableHeader } from "./QueriesDataTableHeader";
import type { ConversationRow } from "./types";
import type { TimeRange } from "./utils/get-request-params";

interface QueriesDataTableProps<TData, TValue> {
    columns: ColumnDef<TData, TValue>[];
    data: TData[];
    baseDocsUrl: string;
    onSelectConversation: (conversation: FernAI.Conversation) => void;
    selectedConversation: FernAI.Conversation | null;
    queryTimeRange: TimeRange;
    setQueryTimeRange: (range: TimeRange) => void;
    onExport: () => void;
    isExporting?: boolean;
}

export function QueriesDataTable<TData, TValue>({
    columns,
    data,
    baseDocsUrl,
    onSelectConversation,
    selectedConversation,
    queryTimeRange,
    setQueryTimeRange,
    onExport,
    isExporting
}: QueriesDataTableProps<TData, TValue>) {
    const table = useReactTable({
        data,
        columns,
        getCoreRowModel: getCoreRowModel(),
        getSortedRowModel: getSortedRowModel(),
        getFilteredRowModel: getFilteredRowModel()
    });

    function onClickRow(row: Row<TData>) {
        return async () => {
            const conversation = await getConversation({
                domain: baseDocsUrl,
                conversationId: (row.original as ConversationRow).conversation_id
            });
            onSelectConversation(conversation);
        };
    }

    function renderCell(cell: Cell<TData, TValue>) {
        return (
            <TableCell
                key={cell.id}
                className={
                    cell.column.id === "conversation"
                        ? "pl-0"
                        : cell.column.id === "created_at"
                          ? "w-32"
                          : cell.column.id === "message_count" || cell.column.id === "source"
                            ? "w-24"
                            : undefined
                }
            >
                {flexRender(cell.column.columnDef.cell, cell.getContext())}
            </TableCell>
        );
    }

    return (
        <div className="flex w-full flex-row gap-6 rounded-md">
            <div className="grow">
                <QueriesDataTableHeader
                    table={table}
                    queryTimeRange={queryTimeRange}
                    setQueryTimeRange={setQueryTimeRange}
                    onExport={onExport}
                    isExporting={isExporting}
                />
                <div className="max-h-[400px] min-h-[400px] overflow-y-auto">
                    <Table className="table-fixed">
                        <TableHeader>
                            {table.getHeaderGroups().map((headerGroup) => (
                                <TableRow key={headerGroup.id} className="border-none">
                                    {headerGroup.headers.map((header) => (
                                        <TableHead
                                            key={header.id}
                                            style={{ fontFamily: "Berkeley Mono, monospace" }}
                                            className={
                                                header.column.id === "conversation"
                                                    ? "pl-0"
                                                    : header.column.id === "created_at"
                                                      ? "w-32 text-right"
                                                      : header.column.id === "message_count" ||
                                                          header.column.id === "source"
                                                        ? "w-24"
                                                        : undefined
                                            }
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
                            {table.getRowModel().rows.length ? (
                                table.getRowModel().rows.map((row) => (
                                    <TableRow
                                        key={row.id}
                                        data-state={
                                            selectedConversation?.conversation_id ===
                                                (row.original as ConversationRow).conversation_id && "selected"
                                        }
                                        className="data-[state=selected]:bg-accent cursor-pointer border-none"
                                        onClick={onClickRow(row)}
                                    >
                                        {row.getVisibleCells().map((cell) => renderCell(cell))}
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={columns.length} className="h-24 text-center">
                                        No results.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>
            </div>
        </div>
    );
}
