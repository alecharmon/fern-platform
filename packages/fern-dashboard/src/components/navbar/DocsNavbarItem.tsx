"use client";

import { ChevronRightIcon } from "lucide-react";
import Link from "next/link";
import { useCallback, useRef, useState } from "react";
import type { Auth0OrgName } from "@/app/services/auth0/types";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipProvider } from "@/components/ui/tooltip";
import { useIsMobile } from "@/hooks/use-mobile";
import { useIsSidebarCollapsed } from "@/state/sidebar-collapse";
import { useOrgNameFromPathname } from "@/utils/useOrgNameFromPathname";
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
import { type BasepathTreeNode, type DocsSiteGroup, groupDocsSitesByDomain } from "./groupDocsSitesByDomain";
import { ICON_SIZE, NavbarItem } from "./NavbarItem";

interface DocsNavbarItemProps {
    firstDocsSiteUrlParam?: string;
    docsSitesData: DocsSiteData[];
    orgName: Auth0OrgName;
    multiRepoDomains: string[];
}

export function DocsNavbarItem({
    firstDocsSiteUrlParam,
    docsSitesData,
    orgName,
    multiRepoDomains
}: DocsNavbarItemProps) {
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
                            multiRepoDomains={multiRepoDomains}
                            onItemClick={() => setIsPopoverOpen(false)}
                        />
                    </PopoverContent>
                </Popover>
            </>
        );
    }

    const multiRepoDomainsSet = new Set(multiRepoDomains);
    const groups = groupDocsSitesByDomain(docsSitesData, multiRepoDomainsSet);

    // Expanded state: show book icon with sub-items below
    return (
        <>
            <NavbarItem
                title="Docs"
                icon={<BookIcon strokeColor={strokeColor} size={ICON_SIZE} />}
                href="/docs"
                hrefForActualLinking={hrefForActualLinking}
            />
            {groups.map((group) =>
                group.isMultiRepo ? (
                    <DocsNavbarGroupItem key={group.domain} group={group} />
                ) : (
                    group.sites.map((site) => (
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
                    ))
                )
            )}
            <AuthZWrapper permission="manage-settings">
                <AddNewSiteButton orgName={orgName} />
            </AuthZWrapper>
        </>
    );
}

function DocsNavbarGroupItem({ group }: { group: DocsSiteGroup }) {
    const orgName = useOrgNameFromPathname();
    const pathname = usePathnameWithoutOrgName();

    const isAnyChildSelected = group.sites.some((site) => {
        const siteHref = `/docs/${site.urlParam}`;
        return pathname === siteHref || pathname.startsWith(`${siteHref}/`);
    });

    // Start collapsed unless a child is already selected
    const [isExpanded, setIsExpanded] = useState(isAnyChildSelected);

    const { rootSite, tree } = group;
    // Always have a navigable site for the domain header: prefer rootSite, fall back to first site
    const headerSite = rootSite ?? group.sites[0];
    const headerHref = headerSite != null ? `/docs/${headerSite.urlParam}` : undefined;

    const lineColor = isAnyChildSelected ? "bg-green-1100" : "bg-gray-700";

    const domainHeaderClassName = cn(
        "hidden md:flex",
        "flex-1 flex-row gap-2 text-sm transition cursor-pointer",
        isAnyChildSelected ? "text-primary" : "hover:text-gray-1100 text-gray-900"
    );

    const domainLabel = (
        <div className="flex min-w-0 items-center py-1.5">
            <TooltipProvider>
                <Tooltip content={group.domain} side="right">
                    <div className="truncate">{group.domain}</div>
                </Tooltip>
            </TooltipProvider>
        </div>
    );

    return (
        <>
            <div className={domainHeaderClassName}>
                <div className="flex w-5 shrink-0 justify-center">
                    <div className={cn("w-px", lineColor)} />
                </div>
                {headerHref != null ? (
                    <Link
                        href={`/${orgName}${headerHref}`}
                        className="flex min-w-0"
                        onClick={() => setIsExpanded(true)}
                    >
                        {domainLabel}
                    </Link>
                ) : (
                    <button type="button" onClick={() => setIsExpanded(!isExpanded)} className="flex min-w-0">
                        {domainLabel}
                    </button>
                )}
                <button
                    type="button"
                    onClick={() => setIsExpanded(!isExpanded)}
                    className="flex shrink-0 items-center px-1"
                >
                    <ChevronRightIcon className={cn("size-3 transition-transform", isExpanded && "rotate-90")} />
                </button>
            </div>
            {isExpanded && <BasepathTreeItems nodes={tree} orgName={orgName} pathname={pathname} depth={0} />}
        </>
    );
}

function BasepathTreeItems({
    nodes,
    orgName,
    pathname,
    depth
}: {
    nodes: BasepathTreeNode[];
    orgName: string;
    pathname: string;
    depth: number;
}) {
    return (
        <>
            {nodes.map((node) => (
                <BasepathTreeNodeItem
                    key={node.site?.url ?? node.segment}
                    node={node}
                    orgName={orgName}
                    pathname={pathname}
                    depth={depth}
                />
            ))}
        </>
    );
}

function BasepathTreeNodeItem({
    node,
    orgName,
    pathname,
    depth
}: {
    node: BasepathTreeNode;
    orgName: string;
    pathname: string;
    depth: number;
}) {
    const site = node.site;
    const hasChildren = node.children.length > 0;
    const siteHref = site ? (`/docs/${site.urlParam}` as const) : undefined;
    const isSelected = siteHref ? pathname === siteHref || pathname.startsWith(`${siteHref}/`) : false;

    // Check if any descendant is selected (for auto-expanding)
    const isAnyDescendantSelected = hasChildren && isDescendantSelected(node.children, pathname);
    const [isExpanded, setIsExpanded] = useState(isSelected || isAnyDescendantSelected);

    const label = `/${node.segment}`;
    // Indent based on depth: depth 0 = pl-2, depth 1 = pl-6, etc.
    const paddingLeft = `${0.5 + depth * 1}rem`;

    const className = cn(
        "hidden md:flex",
        "flex-1 flex-row gap-2 text-sm transition",
        isSelected ? "text-primary" : "hover:text-gray-1100 text-gray-900"
    );

    const nodeLabel = (
        <div className="flex min-w-0 items-center py-1" style={{ paddingLeft }}>
            <TooltipProvider>
                <Tooltip content={site?.url ?? label} side="right">
                    <div className="truncate">{label}</div>
                </Tooltip>
            </TooltipProvider>
        </div>
    );

    const linkContent = (
        <>
            <div className="flex w-5 shrink-0 justify-center">
                <div className={cn("w-px", isSelected ? "bg-green-1100" : "bg-gray-700")} />
            </div>
            {site && siteHref ? (
                isSelected ? (
                    <div className="flex min-w-0">{nodeLabel}</div>
                ) : (
                    <Link
                        href={`/${orgName}${siteHref}`}
                        className="flex min-w-0"
                        onClick={hasChildren ? () => setIsExpanded(true) : undefined}
                    >
                        {nodeLabel}
                    </Link>
                )
            ) : (
                <div className="flex min-w-0">{nodeLabel}</div>
            )}
            {hasChildren && (
                <button
                    type="button"
                    onClick={() => setIsExpanded(!isExpanded)}
                    className="flex shrink-0 items-center px-1"
                >
                    <ChevronRightIcon className={cn("size-3 transition-transform", isExpanded && "rotate-90")} />
                </button>
            )}
        </>
    );

    return (
        <>
            {site ? (
                <AuthZWrapper
                    permission="view"
                    permissionScope={docsPermissionScope(site.url)}
                    loadingFallback={<DocsNavbarSubItemSkeleton />}
                >
                    <div className={className}>{linkContent}</div>
                </AuthZWrapper>
            ) : (
                <div className={className}>{linkContent}</div>
            )}
            {hasChildren && isExpanded && (
                <BasepathTreeItems nodes={node.children} orgName={orgName} pathname={pathname} depth={depth + 1} />
            )}
        </>
    );
}

function isDescendantSelected(nodes: BasepathTreeNode[], pathname: string): boolean {
    for (const node of nodes) {
        if (node.site != null) {
            const href = `/docs/${node.site.urlParam}`;
            if (pathname === href || pathname.startsWith(`${href}/`)) {
                return true;
            }
        }
        if (node.children.length > 0 && isDescendantSelected(node.children, pathname)) {
            return true;
        }
    }
    return false;
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
