"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState, useTransition } from "react";

import { type AdminSiteDetail, getAdminSiteDetails } from "@/app/actions/getAdminData";
import { Input } from "@/components/ui/input";
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

export function SitesPanel() {
    const router = useRouter();
    const currentSearchParams = useSearchParams();
    const [isPending, startTransition] = useTransition();

    const page = Number(currentSearchParams.get("page") ?? "1");
    const search = currentSearchParams.get("search") ?? "";

    const [sites, setSites] = useState<AdminSiteDetail[]>([]);
    const [total, setTotal] = useState(0);
    const [error, setError] = useState<string | null>(null);
    const [searchInput, setSearchInput] = useState(search);

    const fetchSites = useCallback(async () => {
        const offset = (page - 1) * PAGE_SIZE;
        const result = await getAdminSiteDetails({
            limit: PAGE_SIZE,
            offset,
            orgIdFilter: search || undefined
        });

        if ("error" in result) {
            setError(result.error);
            return;
        }

        setSites(result.sites);
        setTotal(result.total);
        setError(null);
    }, [page, search]);

    useEffect(() => {
        fetchSites();
    }, [fetchSites]);

    const totalPages = Math.ceil(total / PAGE_SIZE);

    function updateParams(updates: Record<string, string>) {
        const params = new URLSearchParams(currentSearchParams.toString());
        for (const [key, value] of Object.entries(updates)) {
            params.set(key, value);
        }
        startTransition(() => {
            router.push(`/admin/sites?${params.toString()}`);
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
                    placeholder="Filter by org or domain..."
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === "Enter") {
                            handleSearch();
                        }
                    }}
                    className="max-w-sm"
                />
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
                {total} site{total !== 1 ? "s" : ""} found
            </div>

            <div className="rounded-md border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Organization</TableHead>
                            <TableHead>Domain</TableHead>
                            <TableHead>Basepath</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Live publishes</TableHead>
                            <TableHead>Preview publishes</TableHead>
                            <TableHead>Last deployment</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {sites.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={7} className="text-muted-foreground py-8 text-center">
                                    No sites found
                                </TableCell>
                            </TableRow>
                        ) : (
                            sites.map((site) => (
                                <TableRow key={site.id}>
                                    <TableCell className="font-medium">{site.orgId}</TableCell>
                                    <TableCell>
                                        <a
                                            href={`https://${site.domain}${site.basepath || ""}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-blue-600 hover:underline"
                                        >
                                            {site.domain}
                                        </a>
                                    </TableCell>
                                    <TableCell>{site.basepath || "/"}</TableCell>
                                    <TableCell>
                                        <StatusBadge status={site.status} />
                                    </TableCell>
                                    <TableCell>{site.livePublishCount}</TableCell>
                                    <TableCell>{site.previewPublishCount}</TableCell>
                                    <TableCell className="text-muted-foreground">
                                        {site.lastDeploymentAt
                                            ? new Date(site.lastDeploymentAt).toLocaleDateString()
                                            : "Never"}
                                        {site.lastDeploymentStatus && (
                                            <span className="ml-1">
                                                <StatusBadge status={site.lastDeploymentStatus} />
                                            </span>
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
