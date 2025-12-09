"use client";

import type { FernAI } from "@fern-api/fai-sdk";

import {
    type ColumnDef,
    flexRender,
    getCoreRowModel,
    getFilteredRowModel,
    getSortedRowModel,
    type Row,
    useReactTable
} from "@tanstack/react-table";
import { useCallback } from "react";

import { getConversation } from "@/app/actions/getConversation";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

import { QueriesDataTableHeader } from "./QueriesDataTableHeader";
import type { ConversationRow } from "./types";

interface QueriesDataTableProps<TData, TValue> {
    columns: ColumnDef<TData, TValue>[];
    data: TData[];
    baseDocsUrl: string;
    onSelectConversation: (conversation: FernAI.Conversation | null) => void;
    selectedConversation: FernAI.Conversation | null;
    onExport: () => void;
    isExporting?: boolean;
}

export function QueriesDataTable<TData, TValue>({
    columns,
    data,
    baseDocsUrl,
    onSelectConversation,
    selectedConversation,
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
            const convoId = (row.original as ConversationRow).conversation_id;
            try {
                onSelectConversation({
                    conversation_id: convoId,
                    created_at: (row.original as ConversationRow).created_at,
                    turns: []
                } as FernAI.Conversation);

                const conversation = await getConversation({
                    domain: baseDocsUrl,
                    conversationId: convoId
                });
                onSelectConversation(conversation);
            } catch (err) {
                console.error("Failed to load conversation", {
                    err,
                    domain: baseDocsUrl,
                    conversationId: convoId
                });
                onSelectConversation(null);
            }
        };
    }

    const handleRowRender = useCallback((row: Row<TData>) => {
        const rowA = row.getVisibleCells().find((c) => c.column.id === "source")?.column.columnDef.cell;
        const rowB = row
            .getVisibleCells()
            .find((c) => c.column.id === "source")
            ?.getContext();
        if (rowA && rowB) {
            return flexRender(rowA, rowB);
        }
        return null;
    }, []);

    return (
        <div className="flex w-full flex-row gap-6 rounded-md">
            <div className="grow">
                <QueriesDataTableHeader table={table} onExport={onExport} isExporting={isExporting} />
                <div className="max-h-[400px] min-h-[400px] overflow-y-auto">
                    <Table className="table-fixed">
                        <TableHeader className="hidden md:table-header-group">
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
                                        className="data-[state=selected]:bg-accent cursor-pointer border-b border-none py-3 last:border-b-0 md:border-b-0"
                                        onClick={onClickRow(row)}
                                    >
                                        {row.getVisibleCells().map((cell) => {
                                            if (cell.column.id === "conversation") {
                                                return (
                                                    <TableCell key={cell.id} className="p-2 md:pl-0">
                                                        <div className="md:hidden">
                                                            <div
                                                                className="truncate font-medium"
                                                                style={{ fontFamily: "GT Planar, sans-serif" }}
                                                            >
                                                                {(row.original as ConversationRow).first_query}
                                                            </div>
                                                            <div className="text-gray-1000 flex items-center gap-2 text-sm">
                                                                {handleRowRender(row)}
                                                                <span>•</span>
                                                                <span>
                                                                    {(row.original as ConversationRow).message_count}{" "}
                                                                    messages
                                                                </span>
                                                                <span>•</span>
                                                                <span>
                                                                    {new Date(
                                                                        (row.original as ConversationRow).created_at
                                                                    ).toLocaleDateString("en-US", {
                                                                        month: "short",
                                                                        day: "numeric",
                                                                        year: "numeric"
                                                                    })}
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
                                                    className={
                                                        cell.column.id === "created_at"
                                                            ? "hidden w-32 md:table-cell"
                                                            : cell.column.id === "message_count" ||
                                                                cell.column.id === "source"
                                                              ? "hidden w-24 md:table-cell"
                                                              : "hidden md:table-cell"
                                                    }
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
