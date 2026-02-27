"use client";

import { PlusIcon } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import type { Auth0OrgName } from "@/app/services/auth0/types";
import type { DocsSiteData } from "@/components/navbar/DocsNavbarItems";
import { Tooltip, TooltipProvider } from "@/components/ui/tooltip";
import { UpsellGate } from "@/components/upsells/UpsellGate";
import { useOrgNameFromPathname } from "@/utils/useOrgNameFromPathname";
import { cn } from "@/utils/utils";

interface DocsSitesListProps {
    docsSitesData: DocsSiteData[];
    orgName: Auth0OrgName;
    isCreateDocsNewSiteEnabled: boolean;
    onItemClick?: () => void;
}

export function DocsSitesList({ docsSitesData, orgName, isCreateDocsNewSiteEnabled, onItemClick }: DocsSitesListProps) {
    const params = useParams();
    const currentOrgName = useOrgNameFromPathname();

    return (
        <div className="flex flex-col gap-1">
            {docsSitesData.map((site) => {
                const isSiteSelected = params.docsUrl ? site.urlParam === String(params.docsUrl) : false;
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
            <UpsellGate feature="docs_sites">
                <Link
                    href={
                        isCreateDocsNewSiteEnabled
                            ? `/get-started/${orgName}/docs`
                            : "https://buildwithfern.com/learn/docs/getting-started/quickstart"
                    }
                    className={cn(
                        "flex items-center gap-2 px-3 py-2 text-sm rounded-md transition",
                        "hover:bg-gray-100 dark:hover:bg-accent text-gray-900"
                    )}
                    target={isCreateDocsNewSiteEnabled ? "_self" : "_blank"}
                    onClick={onItemClick}
                >
                    <PlusIcon className="h-4 w-4" />
                    <div className="truncate">Add new site</div>
                </Link>
            </UpsellGate>
        </div>
    );
}
