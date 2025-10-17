"use client";

import type { ColumnDef } from "@tanstack/react-table";

import { ChannelIcon } from "./ChannelIcon";
import type { ConversationRow } from "./types";

export const columns: ColumnDef<ConversationRow>[] = [
    {
        id: "conversation",
        accessorFn: (row) => row.first_query,
        header: "Conversation",
        cell: ({ row }) => {
            const text = row.getValue("conversation") as string | undefined;
            return (
                <div className="truncate" title={text} style={{ fontFamily: "GT Planar, sans-serif" }}>
                    {text}
                </div>
            );
        }
    },
    {
        accessorKey: "source",
        header: "Channel",
        cell: ({ row }) => {
            const source = row.getValue("source") as string | undefined;
            return <ChannelIcon source={source} />;
        }
    },
    {
        accessorKey: "message_count",
        header: "Messages",
        cell: ({ row }) => {
            const count = row.getValue("message_count") as number;
            return <div style={{ fontFamily: "Berkeley Mono, monospace" }}>{count}</div>;
        }
    },
    {
        accessorKey: "created_at",
        header: "Date",
        cell: ({ row }) => {
            const createdAt = row.getValue("created_at") as string | number | Date;
            const date = new Date(createdAt);
            return (
                <div className="text-left md:text-right" style={{ fontFamily: "GT Planar, sans-serif" }}>
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
