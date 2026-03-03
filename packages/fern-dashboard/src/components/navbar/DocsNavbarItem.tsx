"use client";

import { useCallback, useRef, useState } from "react";
import type { Auth0OrgName } from "@/app/services/auth0/types";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useIsMobile } from "@/hooks/use-mobile";
import { useIsSidebarCollapsed } from "@/state/sidebar-collapse";
import { usePathnameWithoutOrgName } from "@/utils/usePathnameWithoutOrgName";
import { cn } from "@/utils/utils";
import { docsPermissionScope } from "../auth/authz";
import { AuthZWrapper } from "../auth/authz/AuthZWrapper";
import { Skeleton } from "../ui/skeleton";
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
}

export function DocsNavbarItem({ firstDocsSiteUrlParam, docsSitesData, orgName }: DocsNavbarItemProps) {
    const pathname = usePathnameWithoutOrgName();
    const [isCollapsed] = useIsSidebarCollapsed();
    const isMobile = useIsMobile();
    const [isPopoverOpen, setIsPopoverOpen] = useState(false);
    const closeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const openPopover = useCallback(() => {
        if (isMobile) {
            return;
        }
        if (closeTimeoutRef.current != null) {
            clearTimeout(closeTimeoutRef.current);
            closeTimeoutRef.current = null;
        }
        setIsPopoverOpen(true);
    }, [isMobile]);

    const closePopover = useCallback(() => {
        if (isMobile) {
            return;
        }
        closeTimeoutRef.current = setTimeout(() => {
            setIsPopoverOpen(false);
            closeTimeoutRef.current = null;
        }, 100);
    }, [isMobile]);

    const href = `/docs`;
    const isSelected = pathname.startsWith(href);
    const strokeColor = isSelected ? "var(--primary)" : "var(--gray-900)";
    const hrefForActualLinking = firstDocsSiteUrlParam ? `/docs/${firstDocsSiteUrlParam}` : undefined;

    // Mobile or collapsed state: show book icon with popover
    if (isMobile || isCollapsed) {
        return (
            <>
                <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
                    <PopoverTrigger asChild>
                        <div
                            className={cn(
                                "group flex flex-1 flex-col items-center gap-2 py-2 text-sm transition md:flex-row focus:ring-0 focus:outline-none px-2 md:px-0 md:justify-center cursor-pointer",
                                isSelected ? "text-primary" : "text-gray-900 hover:text-gray-1100"
                            )}
                            onMouseEnter={openPopover}
                            onMouseLeave={closePopover}
                        >
                            <BookIcon strokeColor={strokeColor} size={ICON_SIZE} />
                            {isMobile && <div>Docs</div>}
                        </div>
                    </PopoverTrigger>
                    <PopoverContent
                        className="w-64 p-2"
                        align={isMobile ? "center" : "start"}
                        side={isMobile ? "top" : "right"}
                        onMouseEnter={openPopover}
                        onMouseLeave={closePopover}
                    >
                        <DocsSitesList
                            docsSitesData={docsSitesData}
                            orgName={orgName}
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
                <AuthZWrapper
                    key={site.url + "auth-wrapper"}
                    permission="view"
                    permissionScope={docsPermissionScope(site.url)}
                    loadingFallback={<DocsNavbarSubItemSkeleton />}
                >
                    <DocsNavbarSubItem
                        key={site.url}
                        title={site.url}
                        href={`/docs/${site.urlParam}`}
                        urlParam={site.urlParam}
                    />
                </AuthZWrapper>
            ))}
            <AuthZWrapper permission="manage-settings">
                <AddNewSiteButton orgName={orgName} />
            </AuthZWrapper>
        </>
    );
}

function DocsNavbarSubItemSkeleton() {
    return (
        <div className="hidden md:flex flex-1 flex-row items-center gap-2 py-2 pr-4 text-sm text-gray-900">
            <div className="flex w-5 shrink-0 justify-center">
                <div className="w-px bg-gray-700" />
            </div>
            <Skeleton className="h-4 w-32" />
        </div>
    );
}
