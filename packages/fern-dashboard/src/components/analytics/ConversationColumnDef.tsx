"use client";

import { ColumnDef } from "@tanstack/react-table";

import { FernFai } from "@fern-api/fai-sdk";

export const columns: ColumnDef<FernFai.Query>[] = [
  {
    id: "query",
    accessorFn: (query) => query.text,
    header: "Query",
    cell: ({ row }) => {
      const text = row.getValue("query") as string | undefined;
      return (
        <div className="truncate" title={text}>
          {text}
        </div>
      );
    },
  },
  {
    accessorKey: "created_at",
    header: "",
    cell: ({ row }) => {
      const createdAt = row.getValue("created_at") as string | number | Date;
      const date = new Date(createdAt);
      return (
        <div className="text-left md:text-right">
          {date.toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          })}
        </div>
      );
    },
  },
];
