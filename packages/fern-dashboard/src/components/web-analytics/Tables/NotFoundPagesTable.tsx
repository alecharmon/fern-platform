"use client";

import { useMemo, useState } from "react";

import type { TableRequest } from "@/app/actions/getWebAnalytics";
import type { Auth0OrgName } from "@/app/services/auth0/types";
import { Button } from "@/components/ui/button";
import type { DocsUrl } from "@/utils/types";

import { useAnalyticsData } from "../AnalyticsDataContext";
import { CreateRedirectModal } from "../CreateRedirectModal";
import { ANALYTICS_SORT_DIR } from "../constants";
import { useAnalyticsTable } from "../hooks/useAnalyticsTable";
import AnalyticsMiniTable from "./AnalyticsMiniTable";

interface NotFoundPagesTableProps {
    docsUrl: DocsUrl;
    dateRange?: TableRequest["dateRange"];
    orgName?: Auth0OrgName;
    gitUrl?: string;
    baseBranch?: string;
}

export default function NotFoundPagesTable({
    docsUrl,
    dateRange,
    orgName,
    gitUrl,
    baseBranch
}: NotFoundPagesTableProps) {
    const { data, isLoading, error } = useAnalyticsData();
    const { sortState, handleSort } = useAnalyticsTable();
    const [modalOpen, setModalOpen] = useState(false);
    const [selectedPath, setSelectedPath] = useState("");

    const sortedPages404 = useMemo(() => {
        if (!data?.pages404) {
            return undefined;
        }
        const pages = [...data.pages404];
        pages.sort((a, b) => (sortState.order === ANALYTICS_SORT_DIR.DESC ? b.count - a.count : a.count - b.count));
        return pages;
    }, [data?.pages404, sortState]);

    const handleCreateRedirect = (path: string) => {
        setSelectedPath(path);
        setModalOpen(true);
    };

    const canCreateRedirects = orgName && gitUrl && baseBranch;

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

    if (!sortedPages404 || sortedPages404.length === 0) {
        return null;
    }

    return (
        <>
            <AnalyticsMiniTable
                title="404 Pages"
                data={sortedPages404}
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
                    gitUrl={gitUrl!}
                    baseBranch={baseBranch!}
                />
            )}
        </>
    );
}
