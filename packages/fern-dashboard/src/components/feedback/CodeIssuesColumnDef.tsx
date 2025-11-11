"use client";

import type { ColumnDef } from "@tanstack/react-table";

import type { FeedbackEntry } from "@/app/actions/getFeedback";

import { ColumnHeaderWithFilter } from "./ColumnHeaderWithFilter";

export const codeIssuesColumns: ColumnDef<FeedbackEntry>[] = [
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
        accessorKey: "language",
        header: ({ column }) => <ColumnHeaderWithFilter column={column} title="Language" />,
        cell: ({ row }) => {
            const language = (row.getValue("language") as string) || "Unknown";
            return (
                <div className="truncate" title={language} style={{ fontFamily: "GT Planar, sans-serif" }}>
                    {language}
                </div>
            );
        },
        filterFn: (row, id, value) => {
            const cellValue = String(row.getValue(id) || "Unknown").toLowerCase();
            return cellValue.includes(String(value).toLowerCase());
        }
    },
    {
        accessorKey: "code",
        header: ({ column }) => <ColumnHeaderWithFilter column={column} title="Code" />,
        cell: ({ row }) => {
            const code = (row.getValue("code") as string) || "Unknown";
            return (
                <div className="truncate" title={code} style={{ fontFamily: "Berkeley Mono, monospace" }}>
                    {code}
                </div>
            );
        },
        filterFn: (row, id, value) => {
            const cellValue = String(row.getValue(id) || "Unknown").toLowerCase();
            return cellValue.includes(String(value).toLowerCase());
        }
    },
    {
        accessorKey: "userFeedback",
        header: ({ column }) => <ColumnHeaderWithFilter column={column} title="User Feedback" />,
        cell: ({ row }) => {
            const feedback = (row.getValue("userFeedback") as string) || "";
            return (
                <div className="truncate" title={feedback} style={{ fontFamily: "GT Planar, sans-serif" }}>
                    {feedback}
                </div>
            );
        },
        filterFn: (row, id, value) => {
            const cellValue = String(row.getValue(id) || "").toLowerCase();
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
