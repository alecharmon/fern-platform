"use client";

import type { ColumnDef } from "@tanstack/react-table";

import type { FeedbackEntry } from "@/app/actions/getFeedback";

import { ColumnHeaderWithFilter } from "./ColumnHeaderWithFilter";

export const columns: ColumnDef<FeedbackEntry>[] = [
    {
        accessorKey: "currentUrl",
        header: ({ column }) => <ColumnHeaderWithFilter column={column} title="Current URL" className="pl-0" />,
        cell: ({ row }) => {
            const url = row.getValue("currentUrl") as string;
            return (
                <div className="truncate pl-0" title={url} style={{ fontFamily: "GT Planar, sans-serif" }}>
                    {url}
                </div>
            );
        },
        filterFn: (row, id, value) => {
            const cellValue = String(row.getValue(id)).toLowerCase();
            return cellValue.includes(String(value).toLowerCase());
        }
    },
    {
        accessorKey: "wasHelpful",
        header: ({ column }) => <ColumnHeaderWithFilter column={column} title="Helpful?" />,
        cell: ({ row }) => {
            const wasHelpful = row.getValue("wasHelpful") as boolean;
            return <div style={{ fontFamily: "Berkeley Mono, monospace" }}>{wasHelpful ? "True" : "False"}</div>;
        },
        filterFn: (row, id, value) => {
            if (value === "") return true;
            const cellValue = row.getValue(id) as boolean;
            const filterValue = String(value).toLowerCase();
            if (filterValue === "true") return cellValue === true;
            if (filterValue === "false") return cellValue === false;
            return true;
        }
    },
    {
        accessorKey: "selection",
        header: ({ column }) => <ColumnHeaderWithFilter column={column} title="Reason" />,
        cell: ({ row }) => {
            let selection = row.getValue("selection") as string;
            selection = selection.replaceAll("-", " ");

            const sentenceCased = selection.charAt(0).toUpperCase() + selection.slice(1).toLowerCase();
            return (
                <div className="truncate" title={sentenceCased} style={{ fontFamily: "GT Planar, sans-serif" }}>
                    {sentenceCased}
                </div>
            );
        },
        filterFn: (row, id, value) => {
            const cellValue = String(row.getValue(id)).toLowerCase().replaceAll("-", " ");
            return cellValue.includes(String(value).toLowerCase());
        }
    },
    {
        accessorFn: (row) => (row.userFeedback?.startsWith("[Ask Fern]") ? "Ask Fern" : "Docs"),
        id: "channel",
        header: ({ column }) => <ColumnHeaderWithFilter column={column} title="Channel" />,
        cell: ({ row }) => {
            const channel = row.getValue("channel") as string;
            return (
                <div className="truncate" title={channel} style={{ fontFamily: "GT Planar, sans-serif" }}>
                    {channel}
                </div>
            );
        },
        filterFn: (row, id, value) => {
            const cellValue = String(row.getValue(id)).toLowerCase();
            return cellValue.includes(String(value).toLowerCase());
        }
    },
    {
        accessorKey: "location",
        header: ({ column }) => <ColumnHeaderWithFilter column={column} title="Location" />,
        cell: ({ row }) => {
            const location = row.getValue("location") as string;
            return (
                <div className="truncate" title={location} style={{ fontFamily: "GT Planar, sans-serif" }}>
                    {location}
                </div>
            );
        },
        filterFn: (row, id, value) => {
            const cellValue = String(row.getValue(id)).toLowerCase();
            return cellValue.includes(String(value).toLowerCase());
        }
    },
    {
        accessorKey: "date",
        header: ({ column }) => <ColumnHeaderWithFilter column={column} title="Date" />,
        cell: ({ row }) => {
            const date = new Date(row.getValue("date") as string);
            return (
                <div style={{ fontFamily: "GT Planar, sans-serif" }}>
                    {date.toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric"
                    })}
                </div>
            );
        },
        filterFn: (row, id, value) => {
            const date = new Date(row.getValue(id) as string);
            const formattedDate = date.toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric"
            });
            return formattedDate.toLowerCase().includes(String(value).toLowerCase());
        }
    }
];
