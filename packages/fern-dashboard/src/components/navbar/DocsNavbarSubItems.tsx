"use client";

import type { FdrAPI } from "@fern-api/fdr-sdk/client/types";

import { PlusIcon } from "lucide-react";
import Link from "next/link";

import { constructDocsUrlParam } from "@/utils/constructDocsUrlParam";
import { getDocsSiteUrl } from "@/utils/getDocsSiteUrl";
import { useOrgNameFromPathname } from "@/utils/useOrgNameFromPathname";
import { cn } from "@/utils/utils";

import { NavbarSubItem } from "./NavbarSubItem";

export function DocsNavbarSubItems({ docsSites }: { docsSites: FdrAPI.dashboard.DocsSite[] }) {
    const orgName = useOrgNameFromPathname();

    return (
        <>
            {docsSites.map((docsSite) => {
                const url = getDocsSiteUrl(docsSite);
                const docsUrlParam = constructDocsUrlParam(url);
                return (
                    <NavbarSubItem key={url} title={url} href={`/docs/${docsUrlParam}`} docsUrlParam={docsUrlParam} />
                );
            })}
            <Link
                href={`/${orgName}/docs/new`}
                className={cn(
                    "hidden md:flex",
                    "flex-1 flex-row gap-2 text-sm transition",
                    "hover:text-primary text-gray-900"
                )}
            >
                <div className="flex w-5 shrink-0 justify-center">
                    <div className="w-px bg-gray-700" />
                </div>
                <div className="flex min-w-0 items-center gap-2 py-2 pr-4">
                    <PlusIcon className="h-4 w-4" />
                    <div className="truncate">Add new site</div>
                </div>
            </Link>
        </>
    );
}
