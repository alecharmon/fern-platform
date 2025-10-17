"use client";

import type { FernAI } from "@fern-api/fai-sdk";
import type { ColumnDef } from "@tanstack/react-table";

import { getLocationDisplayText } from "./utils/get-location-display-text";

export const columns: ColumnDef<FernAI.Query>[] = [
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
        }
    },
    {
        accessorKey: "source",
        header: "Location",
        cell: ({ row }) => {
            const source = row.getValue("source") as string | undefined;
            const displayText = getLocationDisplayText(source);
            return <div className="text-left">{displayText}</div>;
        }
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
                        year: "numeric"
                    })}
                </div>
            );
        }
    }
];
