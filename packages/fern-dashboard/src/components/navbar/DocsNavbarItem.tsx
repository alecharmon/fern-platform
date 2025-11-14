"use client";

import { useState } from "react";
import type { Auth0OrgName } from "@/app/services/auth0/types";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useIsSidebarCollapsed } from "@/state/sidebar-collapse";
import { usePathnameWithoutOrgName } from "@/utils/usePathnameWithoutOrgName";
import { cn } from "@/utils/utils";

import { AddNewSiteButton } from "./AddNewSiteButton";
import { BookIcon } from "./BookIcon";
import type { DocsSiteData } from "./DocsNavbarItems";
import { DocsNavbarSubItem } from "./DocsNavbarSubItem";
import { DocsSitesList } from "./DocsSitesList";
import { ICON_SIZE, NavbarItem } from "./NavbarItem";

interface DocsNavbarItemProps {
    firstDocsSiteUrlParam?: string;
    docsSitesData: DocsSiteData[];
    orgName: Auth0OrgName;
    isCreateDocsNewSiteEnabled: boolean;
}

export function DocsNavbarItem({
    firstDocsSiteUrlParam,
    docsSitesData,
    orgName,
    isCreateDocsNewSiteEnabled
}: DocsNavbarItemProps) {
    const pathname = usePathnameWithoutOrgName();
    const [isCollapsed] = useIsSidebarCollapsed();
    const [isPopoverOpen, setIsPopoverOpen] = useState(false);

    const href = `/docs`;
    const isSelected = pathname.startsWith(href);
    const strokeColor = isSelected ? "var(--primary)" : "var(--gray-900)";
    const hrefForActualLinking = firstDocsSiteUrlParam ? `/docs/${firstDocsSiteUrlParam}` : undefined;

    // Collapsed state: show book icon with popover
    if (isCollapsed) {
        return (
            <>
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
                            <BookIcon strokeColor={strokeColor} size={ICON_SIZE} />
                        </div>
                    </PopoverTrigger>
                    <PopoverContent
                        className="w-64 p-2"
                        align="start"
                        side="right"
                        onMouseEnter={() => setIsPopoverOpen(true)}
                        onMouseLeave={() => setIsPopoverOpen(false)}
                    >
                        <DocsSitesList
                            docsSitesData={docsSitesData}
                            orgName={orgName}
                            isCreateDocsNewSiteEnabled={isCreateDocsNewSiteEnabled}
                            onItemClick={() => setIsPopoverOpen(false)}
                        />
                    </PopoverContent>
                </Popover>
            </>
        );
    }

    // Expanded state: show book icon with sub-items below
    return (
        <>
            <NavbarItem
                title="Docs"
                icon={<BookIcon strokeColor={strokeColor} size={ICON_SIZE} />}
                href="/docs"
                hrefForActualLinking={hrefForActualLinking}
            />
            {docsSitesData.map((site) => (
                <DocsNavbarSubItem
                    key={site.url}
                    title={site.url}
                    href={`/docs/${site.urlParam}`}
                    urlParam={site.urlParam}
                />
            ))}
            <AddNewSiteButton orgName={orgName} isCreateDocsNewSiteEnabled={isCreateDocsNewSiteEnabled} />
        </>
    );
}
