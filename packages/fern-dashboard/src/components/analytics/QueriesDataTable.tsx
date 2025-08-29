"use client";

import {
  Cell,
  ColumnDef,
  Row,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";

import { FernAI } from "@fern-api/fai-sdk";

import { getConversation } from "@/app/actions/getConversation";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";

import { QueriesDataTableHeader } from "./QueriesDataTableHeader";
import { TimeRange } from "./utils/get-request-params";

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
  isExporting,
}: QueriesDataTableProps<TData, TValue>) {
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  function onClickRow(row: Row<TData>) {
    return async () => {
      const conversation = await getConversation({
        domain: baseDocsUrl,
        conversationId: (row.original as FernAI.Query).conversation_id,
      });
      onSelectConversation(conversation);
    };
  }

  function renderCell(cell: Cell<TData, TValue>) {
    return (
      <TableCell
        key={cell.id}
        className={
          cell.column.id === "created_at"
            ? "w-32"
            : cell.column.id === "actions"
              ? "w-16"
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
            <TableBody>
              {table.getRowModel().rows.length ? (
                table.getRowModel().rows.map((row) => (
                  <TableRow
                    key={row.id}
                    data-state={
                      selectedConversation?.conversation_id ===
                        (row.original as FernAI.Query).conversation_id &&
                      "selected"
                    }
                    className="data-[state=selected]:bg-accent cursor-pointer border-none"
                    onClick={onClickRow(row)}
                  >
                    {row.getVisibleCells().map((cell) => renderCell(cell))}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={columns.length}
                    className="h-24 text-center"
                  >
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
