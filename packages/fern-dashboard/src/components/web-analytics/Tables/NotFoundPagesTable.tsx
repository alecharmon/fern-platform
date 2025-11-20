"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import type { TableRequest } from "@/app/actions/getWebAnalytics";
import { get404Pages } from "@/app/actions/getWebAnalytics";
import type { Auth0OrgName } from "@/app/services/auth0/types";
import { Button } from "@/components/ui/button";
import type { DocsUrl } from "@/utils/types";

import { CreateRedirectModal } from "../CreateRedirectModal";
import { useAnalyticsTable } from "../hooks/useAnalyticsTable";
import AnalyticsMiniTable from "./AnalyticsMiniTable";

interface NotFoundPagesTableProps {
    docsUrl: DocsUrl;
    dateRange?: TableRequest["dateRange"];
    orgName?: Auth0OrgName;
    githubUrl?: string;
    baseBranch?: string;
}

export default function NotFoundPagesTable({
    docsUrl,
    dateRange,
    orgName,
    githubUrl,
    baseBranch
}: NotFoundPagesTableProps) {
    const { sortState, handleSort } = useAnalyticsTable();
    const [modalOpen, setModalOpen] = useState(false);
    const [selectedPath, setSelectedPath] = useState("");

    const { data, isLoading, error } = useQuery({
        queryKey: ["404Pages", docsUrl, dateRange, sortState],
        queryFn: () =>
            get404Pages({
                docsUrl,
                dateRange,
                orderBy: sortState.field,
                order: sortState.order,
                limit: 10
            }),
        staleTime: 1000 * 60 * 5, // 5 minutes
        refetchOnWindowFocus: false
    });

    const filteredData = data?.pages404 ?? [];

    const handleCreateRedirect = (path: string) => {
        setSelectedPath(path);
        setModalOpen(true);
    };

    const canCreateRedirects = orgName && githubUrl && baseBranch;

    const columns = [
        {
            key: "path",
            label: "",
            width: "auto",
            render: (item: { path: string; count: number }) => (
                <div className="flex w-full items-center justify-between gap-2">
                    <span className="truncate">{item.path}</span>
                    {canCreateRedirects && (
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleCreateRedirect(item.path)}
                            className="h-auto shrink-0 px-2 py-1 text-xs opacity-0 transition-opacity group-hover:opacity-100"
                        >
                            Create Redirect
                        </Button>
                    )}
                </div>
            )
        },
        {
            key: "count",
            label: "Count",
            width: "100px",
            sortable: true,
            format: (value: number) => new Intl.NumberFormat("en-US").format(value)
        }
    ];

    if (!filteredData.length) {
        return null;
    }

    return (
        <>
            <AnalyticsMiniTable
                title="404 Pages"
                data={filteredData}
                isLoading={isLoading}
                error={error}
                columns={columns}
                getItemKey={(item) => item.path}
                showGradient={true}
                gradientKey={sortState.field}
                barVariant="red"
                onSort={handleSort}
                maxLength={45}
                defaultSortField={"count"}
            />
            {canCreateRedirects && (
                <CreateRedirectModal
                    open={modalOpen}
                    onOpenChange={setModalOpen}
                    sourcePath={selectedPath}
                    orgName={orgName!}
                    docsUrl={docsUrl}
                    githubUrl={githubUrl!}
                    baseBranch={baseBranch!}
                />
            )}
        </>
    );
}
