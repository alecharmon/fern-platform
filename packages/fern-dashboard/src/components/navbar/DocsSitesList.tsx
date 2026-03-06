"use client";

import { PlusIcon } from "lucide-react";
import Link from "next/link";
import type { Auth0OrgName } from "@/app/services/auth0/types";
import type { DocsSiteData } from "@/components/navbar/DocsNavbarItems";
import { Tooltip, TooltipProvider } from "@/components/ui/tooltip";
import { useUpsell } from "@/components/upsells/UpsellProvider";
import { useEntitlement } from "@/state/useEntitlement";
import { useOrgNameFromPathname } from "@/utils/useOrgNameFromPathname";
import { usePathnameWithoutOrgName } from "@/utils/usePathnameWithoutOrgName";
import { cn } from "@/utils/utils";

interface DocsSitesListProps {
    docsSitesData: DocsSiteData[];
    orgName: Auth0OrgName;
    onItemClick?: () => void;
}

export function DocsSitesList({ docsSitesData, orgName, onItemClick }: DocsSitesListProps) {
    const currentOrgName = useOrgNameFromPathname();
    const pathname = usePathnameWithoutOrgName();
    const { openUpsell } = useUpsell();
    const { isEntitled } = useEntitlement("docs_sites");

    const addSiteClassName = cn(
        "flex items-center gap-2 px-3 py-2 text-sm rounded-md transition",
        "hover:bg-gray-100 dark:hover:bg-accent text-gray-900"
    );

    const addSiteContent = (
        <>
            <PlusIcon className="h-4 w-4" />
            <div className="truncate">Add new site</div>
        </>
    );

    return (
        <div className="flex flex-col gap-1">
            {docsSitesData.map((site) => {
                const isSiteSelected =
                    pathname === `/docs/${site.urlParam}` || pathname.startsWith(`/docs/${site.urlParam}/`);
                return (
                    <Link
                        key={site.url}
                        href={`/${currentOrgName}/docs/${site.urlParam}`}
                        className={cn(
                            "flex items-center gap-2 px-3 py-2 text-sm rounded-md transition",
                            isSiteSelected
                                ? "bg-green-50 dark:bg-green-900/20 text-primary font-medium"
                                : "hover:bg-gray-100 dark:hover:bg-accent text-gray-900"
                        )}
                        onClick={onItemClick}
                    >
                        <TooltipProvider>
                            <Tooltip content={site.url} side="right">
                                <div className="truncate">{site.url}</div>
                            </Tooltip>
                        </TooltipProvider>
                    </Link>
                );
            })}
            {isEntitled ? (
                <Link href={`/get-started/${orgName}/docs`} className={addSiteClassName} onClick={onItemClick}>
                    {addSiteContent}
                </Link>
            ) : (
                <button
                    className={addSiteClassName}
                    onClick={() => {
                        openUpsell("docs_sites");
                        onItemClick?.();
                    }}
                >
                    {addSiteContent}
                </button>
            )}
        </div>
    );
}
