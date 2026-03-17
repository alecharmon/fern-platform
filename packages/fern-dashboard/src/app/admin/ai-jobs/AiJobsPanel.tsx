"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState, useTransition } from "react";

import { type AdminReindexingJob, getAdminReindexingJobs } from "@/app/actions/getAdminData";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const PAGE_SIZE = 50;

const STATUS_FILTERS = [
    "ALL",
    "completed",
    "failed",
    "queued",
    "received",
    "batching",
    "upserting",
    "syncing",
    "oom_retry"
];

function JobStatusBadge({ status }: { status: string }) {
    const normalized = status.toLowerCase();
    const colorClasses: Record<string, string> = {
        completed: "bg-green-300 text-green-1100",
        failed: "bg-red-300 text-red-1100",
        queued: "bg-gray-300 text-gray-1100",
        received: "bg-blue-400 text-blue-1100",
        batching: "bg-blue-400 text-blue-1100",
        upserting: "bg-blue-400 text-blue-1100",
        syncing: "bg-blue-400 text-blue-1100",
        oom_retry: "bg-amber-200 text-amber-900"
    };

    return (
        <span
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${colorClasses[normalized] ?? "bg-gray-300 text-gray-1100"}`}
        >
            {status}
        </span>
    );
}

function formatDuration(ms: number | null): string {
    if (ms == null) {
        return "-";
    }
    if (ms < 1000) {
        return `${ms}ms`;
    }
    const seconds = Math.round(ms / 1000);
    if (seconds < 60) {
        return `${seconds}s`;
    }
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
}

export function AiJobsPanel() {
    const router = useRouter();
    const currentSearchParams = useSearchParams();
    const [isPending, startTransition] = useTransition();

    const page = Number(currentSearchParams.get("page") ?? "1");
    const search = currentSearchParams.get("search") ?? "";
    const statusFilter = currentSearchParams.get("status") ?? "ALL";

    const [jobs, setJobs] = useState<AdminReindexingJob[]>([]);
    const [total, setTotal] = useState(0);
    const [error, setError] = useState<string | null>(null);
    const [searchInput, setSearchInput] = useState(search);

    const fetchJobs = useCallback(async () => {
        const offset = (page - 1) * PAGE_SIZE;
        const result = await getAdminReindexingJobs({
            limit: PAGE_SIZE,
            offset,
            domainFilter: search || undefined,
            statusFilter: statusFilter !== "ALL" ? statusFilter : undefined
        });

        if ("error" in result) {
            setError(result.error);
            return;
        }

        setJobs(result.jobs);
        setTotal(result.total);
        setError(null);
    }, [page, search, statusFilter]);

    useEffect(() => {
        fetchJobs();
    }, [fetchJobs]);

    const totalPages = Math.ceil(total / PAGE_SIZE);

    function updateParams(updates: Record<string, string>) {
        const params = new URLSearchParams(currentSearchParams.toString());
        for (const [key, value] of Object.entries(updates)) {
            params.set(key, value);
        }
        startTransition(() => {
            router.push(`/admin/ai-jobs?${params.toString()}`);
        });
    }

    function handleSearch() {
        updateParams({ search: searchInput, page: "1" });
    }

    if (error) {
        return <div className="rounded-md border border-red-300 bg-red-50 p-4 text-sm text-red-800">{error}</div>;
    }

    return (
        <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2">
                <Input
                    placeholder="Filter by domain..."
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === "Enter") {
                            handleSearch();
                        }
                    }}
                    className="max-w-sm"
                />
                <select
                    value={statusFilter}
                    onChange={(e) => updateParams({ status: e.target.value, page: "1" })}
                    className="border-border bg-background h-9 rounded-md border px-3 text-sm"
                >
                    {STATUS_FILTERS.map((s) => (
                        <option key={s} value={s}>
                            {s === "ALL" ? "All statuses" : s.toUpperCase()}
                        </option>
                    ))}
                </select>
                <button
                    type="button"
                    onClick={handleSearch}
                    disabled={isPending}
                    className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex h-9 items-center rounded-md px-4 text-sm font-medium transition-colors disabled:opacity-50"
                >
                    {isPending ? "Loading..." : "Search"}
                </button>
            </div>

            <div className="text-muted-foreground text-sm">
                {total} job{total !== 1 ? "s" : ""} found
            </div>

            <div className="rounded-md border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Domain</TableHead>
                            <TableHead>Basepath</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Started</TableHead>
                            <TableHead>Completed</TableHead>
                            <TableHead>Duration</TableHead>
                            <TableHead>Chunk Delta</TableHead>
                            <TableHead>Memory</TableHead>
                            <TableHead>Retries</TableHead>
                            <TableHead>Error</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {jobs.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={10} className="text-muted-foreground py-8 text-center">
                                    No jobs found
                                </TableCell>
                            </TableRow>
                        ) : (
                            jobs.map((job) => (
                                <TableRow key={job.id}>
                                    <TableCell className="max-w-[200px] truncate font-medium" title={job.domain}>
                                        {job.domain}
                                    </TableCell>
                                    <TableCell className="text-muted-foreground">{job.basepath || "/"}</TableCell>
                                    <TableCell>
                                        <JobStatusBadge status={job.status} />
                                    </TableCell>
                                    <TableCell className="text-muted-foreground whitespace-nowrap">
                                        {job.started_at ? new Date(job.started_at).toLocaleString() : "-"}
                                    </TableCell>
                                    <TableCell className="text-muted-foreground whitespace-nowrap">
                                        {job.completed_at ? new Date(job.completed_at).toLocaleString() : "-"}
                                    </TableCell>
                                    <TableCell>{formatDuration(job.job_total_time_ms)}</TableCell>
                                    <TableCell>
                                        {job.num_inserted != null || job.num_deleted != null ? (
                                            <span className="whitespace-nowrap">
                                                {job.num_inserted != null && (
                                                    <span className="text-green-700">+{job.num_inserted}</span>
                                                )}
                                                {job.num_inserted != null && job.num_deleted != null && " / "}
                                                {job.num_deleted != null && (
                                                    <span className="text-red-700">-{job.num_deleted}</span>
                                                )}
                                            </span>
                                        ) : (
                                            "-"
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        {job.memory_mb != null && job.memory_mb > 0 ? `${job.memory_mb} MB` : "-"}
                                    </TableCell>
                                    <TableCell>{job.retry_count > 0 ? job.retry_count : "-"}</TableCell>
                                    <TableCell>
                                        {job.error ? (
                                            <span
                                                className="max-w-[200px] truncate text-xs text-red-600"
                                                title={job.reason ? `${job.error} (${job.reason})` : job.error}
                                            >
                                                {job.error}
                                            </span>
                                        ) : (
                                            "-"
                                        )}
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>

            {totalPages > 1 && (
                <div className="flex items-center justify-between">
                    <button
                        type="button"
                        onClick={() => updateParams({ page: String(page - 1) })}
                        disabled={page <= 1 || isPending}
                        className="border-border hover:bg-muted inline-flex h-9 items-center rounded-md border px-3 text-sm transition-colors disabled:opacity-50"
                    >
                        Previous
                    </button>
                    <span className="text-muted-foreground text-sm">
                        Page {page} of {totalPages}
                    </span>
                    <button
                        type="button"
                        onClick={() => updateParams({ page: String(page + 1) })}
                        disabled={page >= totalPages || isPending}
                        className="border-border hover:bg-muted inline-flex h-9 items-center rounded-md border px-3 text-sm transition-colors disabled:opacity-50"
                    >
                        Next
                    </button>
                </div>
            )}
        </div>
    );
}
