"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState, useTransition } from "react";

import { type AdminDeployment, getAdminDeployments } from "@/app/actions/getAdminData";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const PAGE_SIZE = 50;

function StatusBadge({ status }: { status: string }) {
    const colorClasses: Record<string, string> = {
        LIVE: "bg-green-300 text-green-1100",
        PUBLISHING: "bg-blue-400 text-blue-1100",
        UNPUBLISHED: "bg-gray-300 text-gray-1100",
        ERROR: "bg-red-300 text-red-1100"
    };

    return (
        <span
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${colorClasses[status] ?? "bg-gray-300 text-gray-1100"}`}
        >
            {status}
        </span>
    );
}

export function DeploymentsPanel({
    domain,
    searchParams
}: {
    domain: string;
    searchParams: Promise<{ basepath?: string; page?: string }>;
}) {
    const router = useRouter();
    const currentSearchParams = useSearchParams();
    const [isPending, startTransition] = useTransition();

    const page = Number(currentSearchParams.get("page") ?? "1");
    const basepath = currentSearchParams.get("basepath") ?? undefined;

    const [deployments, setDeployments] = useState<AdminDeployment[]>([]);
    const [total, setTotal] = useState(0);
    const [error, setError] = useState<string | null>(null);

    const fetchDeployments = useCallback(async () => {
        const offset = (page - 1) * PAGE_SIZE;
        const result = await getAdminDeployments({
            domain,
            basepath,
            limit: PAGE_SIZE,
            offset
        });

        if ("error" in result) {
            setError(result.error);
            return;
        }

        setDeployments(result.deployments);
        setTotal(result.total);
        setError(null);
    }, [domain, basepath, page]);

    useEffect(() => {
        fetchDeployments();
    }, [fetchDeployments]);

    const totalPages = Math.ceil(total / PAGE_SIZE);

    function handlePageChange(newPage: number) {
        const params = new URLSearchParams(currentSearchParams.toString());
        params.set("page", String(newPage));
        startTransition(() => {
            router.push(`/admin/organizations/${encodeURIComponent(domain)}?${params.toString()}`);
        });
    }

    if (error) {
        return <div className="rounded-md border border-red-300 bg-red-50 p-4 text-sm text-red-800">{error}</div>;
    }

    return (
        <div className="flex flex-col gap-4">
            <div className="flex items-center gap-4">
                <Link
                    href="/admin/organizations"
                    className="text-muted-foreground hover:text-foreground text-sm transition-colors"
                >
                    &larr; Back to organizations
                </Link>
                <span className="text-muted-foreground text-sm">
                    {total} deployment{total !== 1 ? "s" : ""}
                </span>
            </div>

            <div className="rounded-md border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Deployment ID</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Created</TableHead>
                            <TableHead>Created by</TableHead>
                            <TableHead>Updated</TableHead>
                            <TableHead>Updated by</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {deployments.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={6} className="text-muted-foreground py-8 text-center">
                                    No deployments found
                                </TableCell>
                            </TableRow>
                        ) : (
                            deployments.map((deployment) => (
                                <TableRow key={deployment.id}>
                                    <TableCell className="font-mono text-xs">{deployment.id}</TableCell>
                                    <TableCell>
                                        <StatusBadge status={deployment.status} />
                                    </TableCell>
                                    <TableCell className="text-muted-foreground">
                                        {new Date(deployment.createdAt).toLocaleString()}
                                    </TableCell>
                                    <TableCell className="text-muted-foreground">
                                        {deployment.createdBy ?? "—"}
                                    </TableCell>
                                    <TableCell className="text-muted-foreground">
                                        {new Date(deployment.updatedAt).toLocaleString()}
                                    </TableCell>
                                    <TableCell className="text-muted-foreground">
                                        {deployment.updatedBy ?? "—"}
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
                        onClick={() => handlePageChange(page - 1)}
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
                        onClick={() => handlePageChange(page + 1)}
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
