"use client";

import {
    AlertTriangleIcon,
    CheckCircleIcon,
    DownloadIcon,
    ExternalLinkIcon,
    FileIcon,
    LinkIcon,
    ShieldAlertIcon
} from "lucide-react";
import { useState } from "react";

import type { BrokenLink } from "@/app/api/link-checker/types";
import { Button } from "@/components/ui/button";
import Card from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

import { exportLinkCheckerToCSV } from "./exportLinkCheckerToCSV";

interface LinkCheckerResultsProps {
    totalPages: number;
    totalLinks: number;
    brokenLinks: BrokenLink[];
    blockedLinks: BrokenLink[];
    workingLinks: number;
    skippedLinks: number;
    duration: number;
}

function formatDuration(ms: number): string {
    if (ms < 1000) {
        return `${ms}ms`;
    }
    const seconds = Math.floor(ms / 1000);
    if (seconds < 60) {
        return `${seconds}s`;
    }
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
}

function StatCard({
    icon: Icon,
    label,
    value,
    variant = "default"
}: {
    icon: React.ComponentType<{ className?: string }>;
    label: string;
    value: string | number;
    variant?: "default" | "success" | "warning" | "error";
}) {
    const variantStyles = {
        default: "text-foreground",
        success: "text-green-600 dark:text-green-500",
        warning: "text-yellow-600 dark:text-yellow-500",
        error: "text-red-600 dark:text-red-500"
    };

    return (
        <Card className="flex items-center gap-3 p-4">
            <Icon className={`h-5 w-5 ${variantStyles[variant]}`} />
            <div>
                <p className="text-2xl font-semibold">{value}</p>
                <p className="text-sm text-foreground/70">{label}</p>
            </div>
        </Card>
    );
}

export default function LinkCheckerResults({
    totalPages,
    totalLinks,
    brokenLinks,
    blockedLinks,
    workingLinks,
    duration
}: LinkCheckerResultsProps) {
    const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

    const toggleRow = (key: string) => {
        setExpandedRows((prev) => {
            const next = new Set(prev);
            if (next.has(key)) {
                next.delete(key);
            } else {
                next.add(key);
            }
            return next;
        });
    };

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
                <StatCard icon={FileIcon} label="Pages Checked" value={totalPages} />
                <StatCard icon={LinkIcon} label="Total Links" value={totalLinks} />
                <StatCard icon={CheckCircleIcon} label="Working Links" value={workingLinks} variant="success" />
                <StatCard
                    icon={AlertTriangleIcon}
                    label="Broken Links"
                    value={brokenLinks.length}
                    variant={brokenLinks.length > 0 ? "error" : "success"}
                />
                <StatCard
                    icon={ShieldAlertIcon}
                    label="Blocked"
                    value={blockedLinks.length}
                    variant={blockedLinks.length > 0 ? "warning" : "default"}
                />
            </div>

            <div className="flex items-center justify-between">
                <p className="text-sm text-foreground/70">Completed in {formatDuration(duration)}</p>
                {(brokenLinks.length > 0 || blockedLinks.length > 0) && (
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => exportLinkCheckerToCSV({ brokenLinks, blockedLinks })}
                        className="gap-2"
                    >
                        <DownloadIcon className="h-4 w-4" />
                        Export CSV
                    </Button>
                )}
            </div>

            {brokenLinks.length > 0 ? (
                <div className="space-y-3">
                    <h3 className="text-lg font-semibold">Broken Links</h3>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>URL</TableHead>
                                <TableHead className="w-24">Status</TableHead>
                                <TableHead className="w-24">Type</TableHead>
                                <TableHead className="w-32">Source Pages</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {brokenLinks.map((link, index) => {
                                const rowKey = `broken-${index}`;
                                return (
                                    <TableRow key={index} style={{ contentVisibility: "auto" }}>
                                        <TableCell>
                                            <a
                                                href={link.url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="flex items-center gap-1 text-primary hover:underline"
                                            >
                                                <span className="max-w-md truncate">{link.url}</span>
                                                <ExternalLinkIcon className="h-3 w-3 flex-shrink-0" />
                                            </a>
                                        </TableCell>
                                        <TableCell>
                                            <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800 dark:bg-red-900/30 dark:text-red-400">
                                                {link.statusCode ?? link.error ?? "Error"}
                                            </span>
                                        </TableCell>
                                        <TableCell>
                                            <span
                                                className={`text-xs font-medium ${link.isInternal ? "text-primary" : "text-foreground/70"}`}
                                            >
                                                {link.isInternal ? "Internal" : "External"}
                                            </span>
                                        </TableCell>
                                        <TableCell>
                                            {link.sourcePages.length === 1 ? (
                                                <a
                                                    href={link.sourcePages[0]}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="text-xs text-foreground/80 hover:underline"
                                                >
                                                    1 page
                                                </a>
                                            ) : (
                                                <button
                                                    type="button"
                                                    onClick={() => toggleRow(rowKey)}
                                                    className="text-xs text-primary hover:underline"
                                                >
                                                    {expandedRows.has(rowKey)
                                                        ? "Hide pages"
                                                        : `${link.sourcePages.length} pages`}
                                                </button>
                                            )}
                                            {expandedRows.has(rowKey) && (
                                                <div className="mt-2 space-y-1">
                                                    {link.sourcePages.map((page, pageIndex) => (
                                                        <a
                                                            key={pageIndex}
                                                            href={page}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="block truncate text-xs text-foreground/70 hover:underline"
                                                        >
                                                            {page}
                                                        </a>
                                                    ))}
                                                </div>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                </div>
            ) : (
                <div className="flex items-center gap-2 rounded-lg bg-green-50 p-4 dark:bg-green-900/20">
                    <CheckCircleIcon className="h-5 w-5 text-green-600 dark:text-green-400" />
                    <p className="text-sm text-green-800 dark:text-green-300">No broken links found!</p>
                </div>
            )}

            {blockedLinks.length > 0 && (
                <div className="space-y-3">
                    <h3 className="text-lg font-semibold">Blocked Links</h3>
                    <p className="text-sm text-foreground/70">
                        These links returned 403 errors, likely due to bot detection. They may still be working when
                        accessed from a browser.
                    </p>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>URL</TableHead>
                                <TableHead className="w-32">Source Pages</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {blockedLinks.map((link, index) => {
                                const rowKey = `blocked-${index}`;
                                return (
                                    <TableRow key={index} style={{ contentVisibility: "auto" }}>
                                        <TableCell>
                                            <a
                                                href={link.url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="flex items-center gap-1 text-primary hover:underline"
                                            >
                                                <span className="max-w-md truncate">{link.url}</span>
                                                <ExternalLinkIcon className="h-3 w-3 flex-shrink-0" />
                                            </a>
                                        </TableCell>
                                        <TableCell>
                                            {link.sourcePages.length === 1 ? (
                                                <a
                                                    href={link.sourcePages[0]}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="text-xs text-foreground/80 hover:underline"
                                                >
                                                    1 page
                                                </a>
                                            ) : (
                                                <button
                                                    type="button"
                                                    onClick={() => toggleRow(rowKey)}
                                                    className="text-xs text-primary hover:underline"
                                                >
                                                    {expandedRows.has(rowKey)
                                                        ? "Hide pages"
                                                        : `${link.sourcePages.length} pages`}
                                                </button>
                                            )}
                                            {expandedRows.has(rowKey) && (
                                                <div className="mt-2 space-y-1">
                                                    {link.sourcePages.map((page, pageIndex) => (
                                                        <a
                                                            key={pageIndex}
                                                            href={page}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="block truncate text-xs text-foreground/70 hover:underline"
                                                        >
                                                            {page}
                                                        </a>
                                                    ))}
                                                </div>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                </div>
            )}
        </div>
    );
}
