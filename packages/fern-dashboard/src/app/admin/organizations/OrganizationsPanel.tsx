"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState, useTransition } from "react";

import { type AdminOrgStat, getAdminOrgStats } from "@/app/actions/getAdminData";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/utils/utils";

const PAGE_SIZE = 50;

type SortField = "livePublishes" | "previewPublishes" | "sites" | "lastPublished";

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

function SortableHeader({
    label,
    field,
    currentSort,
    currentOrder,
    onSort
}: {
    label: string;
    field: SortField;
    currentSort: SortField;
    currentOrder: "asc" | "desc";
    onSort: (field: SortField) => void;
}) {
    const isActive = currentSort === field;
    return (
        <TableHead>
            <button
                type="button"
                onClick={() => onSort(field)}
                className="inline-flex items-center gap-1 hover:underline"
            >
                {label}
                {isActive && <span className="text-xs">{currentOrder === "desc" ? "\u2193" : "\u2191"}</span>}
            </button>
        </TableHead>
    );
}

function OrgExpandedRow({ org }: { org: AdminOrgStat }) {
    return (
        <TableRow>
            <TableCell colSpan={6} className="bg-muted/30 p-4">
                <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-3">
                        <span className="text-sm font-medium">Sites ({org.sites.length})</span>
                        <Link href={`/${org.orgId}`} className="text-xs text-blue-600 hover:underline" target="_blank">
                            Open org dashboard
                        </Link>
                    </div>
                    <div className="rounded border bg-background">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Domain</TableHead>
                                    <TableHead>Basepath</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Last updated</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {org.sites.map((site) => (
                                    <TableRow key={`${site.domain}:${site.basepath}`}>
                                        <TableCell>
                                            <Link
                                                href={`/admin/organizations/${encodeURIComponent(site.domain)}${site.basepath ? `?basepath=${encodeURIComponent(site.basepath)}` : ""}`}
                                                className="text-blue-600 hover:underline"
                                            >
                                                {site.domain}
                                            </Link>
                                        </TableCell>
                                        <TableCell>{site.basepath || "/"}</TableCell>
                                        <TableCell>
                                            <StatusBadge status={site.status} />
                                        </TableCell>
                                        <TableCell className="text-muted-foreground">
                                            {new Date(site.updatedAt).toLocaleDateString()}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                </div>
            </TableCell>
        </TableRow>
    );
}

export function OrganizationsPanel() {
    const router = useRouter();
    const currentSearchParams = useSearchParams();
    const [isPending, startTransition] = useTransition();

    const page = Number(currentSearchParams.get("page") ?? "1");
    const search = currentSearchParams.get("search") ?? "";
    const sortBy = (currentSearchParams.get("sortBy") as SortField) ?? "livePublishes";
    const sortOrder = (currentSearchParams.get("sortOrder") as "asc" | "desc") ?? "desc";

    const [orgs, setOrgs] = useState<AdminOrgStat[]>([]);
    const [total, setTotal] = useState(0);
    const [error, setError] = useState<string | null>(null);
    const [searchInput, setSearchInput] = useState(search);
    const [expandedOrgs, setExpandedOrgs] = useState<Set<string>>(new Set());

    const fetchOrgs = useCallback(async () => {
        const offset = (page - 1) * PAGE_SIZE;
        const result = await getAdminOrgStats({
            limit: PAGE_SIZE,
            offset,
            orgIdFilter: search || undefined,
            sortBy,
            sortOrder
        });

        if ("error" in result) {
            setError(result.error);
            return;
        }

        setOrgs(result.orgs);
        setTotal(result.total);
        setError(null);
    }, [page, search, sortBy, sortOrder]);

    useEffect(() => {
        fetchOrgs();
    }, [fetchOrgs]);

    const totalPages = Math.ceil(total / PAGE_SIZE);

    function updateParams(updates: Record<string, string>) {
        const params = new URLSearchParams(currentSearchParams.toString());
        for (const [key, value] of Object.entries(updates)) {
            params.set(key, value);
        }
        startTransition(() => {
            router.push(`/admin/organizations?${params.toString()}`);
        });
    }

    function handleSearch() {
        updateParams({ search: searchInput, page: "1" });
    }

    function handleSort(field: SortField) {
        const newOrder = sortBy === field && sortOrder === "desc" ? "asc" : "desc";
        updateParams({ sortBy: field, sortOrder: newOrder, page: "1" });
    }

    function toggleExpand(orgId: string) {
        setExpandedOrgs((prev) => {
            const next = new Set(prev);
            if (next.has(orgId)) {
                next.delete(orgId);
            } else {
                next.add(orgId);
            }
            return next;
        });
    }

    if (error) {
        return <div className="rounded-md border border-red-300 bg-red-50 p-4 text-sm text-red-800">{error}</div>;
    }

    return (
        <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2">
                <Input
                    placeholder="Search by org name..."
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
                {total} organization{total !== 1 ? "s" : ""} found
            </div>

            <div className="rounded-md border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-8" />
                            <TableHead>Organization</TableHead>
                            <SortableHeader
                                label="Live publishes"
                                field="livePublishes"
                                currentSort={sortBy}
                                currentOrder={sortOrder}
                                onSort={handleSort}
                            />
                            <SortableHeader
                                label="Preview publishes"
                                field="previewPublishes"
                                currentSort={sortBy}
                                currentOrder={sortOrder}
                                onSort={handleSort}
                            />
                            <SortableHeader
                                label="Sites"
                                field="sites"
                                currentSort={sortBy}
                                currentOrder={sortOrder}
                                onSort={handleSort}
                            />
                            <SortableHeader
                                label="Last published"
                                field="lastPublished"
                                currentSort={sortBy}
                                currentOrder={sortOrder}
                                onSort={handleSort}
                            />
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {orgs.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={6} className="text-muted-foreground py-8 text-center">
                                    No organizations found
                                </TableCell>
                            </TableRow>
                        ) : (
                            orgs.flatMap((org) => {
                                const isExpanded = expandedOrgs.has(org.orgId);
                                return [
                                    <TableRow
                                        key={org.orgId}
                                        className={cn("cursor-pointer", isExpanded && "bg-muted/20")}
                                        onClick={() => toggleExpand(org.orgId)}
                                    >
                                        <TableCell className="w-8 text-center">
                                            <span className="text-muted-foreground text-xs">
                                                {isExpanded ? "\u25BC" : "\u25B6"}
                                            </span>
                                        </TableCell>
                                        <TableCell className="font-medium">{org.orgId}</TableCell>
                                        <TableCell>{org.livePublishCount}</TableCell>
                                        <TableCell>{org.previewPublishCount}</TableCell>
                                        <TableCell>{org.siteCount}</TableCell>
                                        <TableCell className="text-muted-foreground">
                                            {org.lastPublishedAt
                                                ? new Date(org.lastPublishedAt).toLocaleDateString()
                                                : "Never"}
                                        </TableCell>
                                    </TableRow>,
                                    isExpanded ? <OrgExpandedRow key={`${org.orgId}-expanded`} org={org} /> : null
                                ];
                            })
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
