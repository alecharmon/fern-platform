"use client";

import type { ColumnDef } from "@tanstack/react-table";

import type { FeedbackEntry } from "@/app/actions/getFeedback";

export const columns: ColumnDef<FeedbackEntry>[] = [
    {
        accessorKey: "currentUrl",
        header: ({ column }) => <div className="pl-0">Current URL</div>,
        cell: ({ row }) => {
            const url = row.getValue("currentUrl") as string;
            return (
                <div className="truncate pl-0" title={url} style={{ fontFamily: "GT Planar, sans-serif" }}>
                    {url}
                </div>
            );
        }
    },
    {
        accessorKey: "wasHelpful",
        header: "Helpful?",
        cell: ({ row }) => {
            const wasHelpful = row.getValue("wasHelpful") as boolean;
            return <div style={{ fontFamily: "Berkeley Mono, monospace" }}>{wasHelpful ? "True" : "False"}</div>;
        }
    },
    {
        accessorKey: "selection",
        header: "Reason",
        cell: ({ row }) => {
            let selection = row.getValue("selection") as string;
            selection = selection.replaceAll("-", " ");

            const sentenceCased = selection.charAt(0).toUpperCase() + selection.slice(1).toLowerCase();
            return (
                <div className="truncate" title={sentenceCased} style={{ fontFamily: "GT Planar, sans-serif" }}>
                    {sentenceCased}
                </div>
            );
        }
    },
    {
        accessorKey: "userFeedback",
        header: "Channel",
        cell: ({ row }) => {
            const feedback = row.getValue("userFeedback") as string;
            let displayValue = feedback || "-";
            if (displayValue.trim() === "[Ask Fern]") {
                displayValue = "Ask Fern";
            } else if (displayValue === "-") {
                displayValue = "Docs";
            }
            return (
                <div className="truncate" title={displayValue} style={{ fontFamily: "GT Planar, sans-serif" }}>
                    {displayValue}
                </div>
            );
        }
    },
    {
        accessorKey: "location",
        header: "Location",
        cell: ({ row }) => {
            const location = row.getValue("location") as string;
            return (
                <div className="truncate" title={location} style={{ fontFamily: "GT Planar, sans-serif" }}>
                    {location}
                </div>
            );
        }
    },
    {
        accessorKey: "date",
        header: "Date",
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
        }
    }
];
