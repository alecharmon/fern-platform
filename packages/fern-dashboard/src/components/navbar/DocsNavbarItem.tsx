"use client";

import type { FdrAPI } from "@fern-api/fdr-sdk/client/types";
import { PlusIcon } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useIsSidebarCollapsed } from "@/state/sidebar-collapse";
import { constructDocsUrlParam } from "@/utils/constructDocsUrlParam";
import { getDocsSiteUrl } from "@/utils/getDocsSiteUrl";
import { useOrgNameFromPathname } from "@/utils/useOrgNameFromPathname";
import { usePathnameWithoutOrgName } from "@/utils/usePathnameWithoutOrgName";
import { cn } from "@/utils/utils";

import { ICON_SIZE, NavbarItem } from "./NavbarItem";

export function DocsNavbarItem({
    hrefForActualLinking,
    docsSites,
    orgName,
    isCreateDocsNewSiteEnabled
}: {
    hrefForActualLinking?: string;
    docsSites?: FdrAPI.dashboard.DocsSite[];
    orgName?: string;
    isCreateDocsNewSiteEnabled?: boolean;
}) {
    const pathname = usePathnameWithoutOrgName();
    const params = useParams();
    const currentOrgName = useOrgNameFromPathname();
    const [isCollapsed] = useIsSidebarCollapsed();
    const [isPopoverOpen, setIsPopoverOpen] = useState(false);
    const href = `/docs`;
    const isSelected = pathname.startsWith(href);
    const strokeColor = isSelected ? "var(--primary)" : "var(--gray-900)";

    const bookIcon = (
        <svg
            className={`book-open ${ICON_SIZE}`}
            viewBox="0 0 20 20"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
        >
            <path
                id="right-lines"
                d="M10 5.03473C11.3269 3.84713 13.0791 3.125 15 3.125C15.8766 3.125 16.7181 3.27539 17.5 3.55176M10 16.9097C11.3269 15.7221 13.0791 15 15 15C15.8766 15 16.7181 15.1504 17.5 15.4268"
                stroke={strokeColor}
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
            <path
                id="right-edge"
                d="M17.5 3.55176V15.4268"
                stroke={strokeColor}
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
            <path
                id="left-lines"
                d="M10 5.03473C8.67311 3.84713 6.92089 3.125 5 3.125C4.12341 3.125 3.28195 3.27539 2.5 3.55176M10 16.9097C8.67311 15.7221 6.92089 15 5 15C4.12341 15 3.28195 15.1504 2.5 15.4268"
                stroke={strokeColor}
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
            <path
                id="left-edge"
                d="M2.5 3.55176V15.4268"
                stroke={strokeColor}
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
            <path
                id="middle"
                d="M10 5.03467V16.9097"
                stroke={strokeColor}
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        </svg>
    );

    if (isCollapsed && docsSites && orgName) {
        return (
            <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
                <PopoverTrigger asChild>
                    <div
                        className={cn(
                            "group flex flex-1 flex-col items-center gap-2 py-2 text-sm transition md:flex-row focus:ring-0 focus:outline-none px-2 md:px-0 md:justify-center cursor-pointer",
                            isSelected ? "text-primary" : "text-gray-900 hover:text-gray-1100"
                        )}
                        onMouseEnter={() => setIsPopoverOpen(true)}
                        onMouseLeave={() => setIsPopoverOpen(false)}
                    >
                        {bookIcon}
                    </div>
                </PopoverTrigger>
                <PopoverContent
                    className="w-64 p-2"
                    align="start"
                    side="right"
                    onMouseEnter={() => setIsPopoverOpen(true)}
                    onMouseLeave={() => setIsPopoverOpen(false)}
                >
                    <div className="flex flex-col gap-1">
                        {docsSites.map((docsSite) => {
                            const url = getDocsSiteUrl(docsSite);
                            const docsUrlParam = constructDocsUrlParam(url);
                            const isSiteSelected = params.docsUrl ? docsUrlParam === String(params.docsUrl) : false;
                            return (
                                <Link
                                    key={url}
                                    href={`/${currentOrgName}/docs/${docsUrlParam}`}
                                    className={cn(
                                        "flex items-center gap-2 px-3 py-2 text-sm rounded-md transition",
                                        isSiteSelected
                                            ? "bg-green-50 text-primary font-medium"
                                            : "hover:bg-gray-100 text-gray-900"
                                    )}
                                    onClick={() => setIsPopoverOpen(false)}
                                >
                                    <div className="truncate">{url}</div>
                                </Link>
                            );
                        })}
                        <Link
                            href={
                                isCreateDocsNewSiteEnabled
                                    ? `/${orgName}/docs/new`
                                    : "https://buildwithfern.com/learn/docs/getting-started/quickstart"
                            }
                            className={cn(
                                "flex items-center gap-2 px-3 py-2 text-sm rounded-md transition",
                                "hover:bg-gray-100 text-gray-900"
                            )}
                            target={isCreateDocsNewSiteEnabled ? "_self" : "_blank"}
                            onClick={() => setIsPopoverOpen(false)}
                        >
                            <PlusIcon className="h-4 w-4" />
                            <div className="truncate">Add new site</div>
                        </Link>
                    </div>
                </PopoverContent>
            </Popover>
        );
    }

    return <NavbarItem title="Docs" icon={bookIcon} href="/docs" hrefForActualLinking={hrefForActualLinking} />;
}
