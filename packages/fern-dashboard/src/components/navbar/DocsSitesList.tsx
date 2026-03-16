"use client";

import { ChevronRightIcon, PlusIcon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import type { Auth0OrgName } from "@/app/services/auth0/types";
import type { DocsSiteData } from "@/components/navbar/DocsNavbarItems";
import { Tooltip, TooltipProvider } from "@/components/ui/tooltip";
import { useUpsell } from "@/components/upsells/UpsellProvider";
import { useEntitlement } from "@/state/useEntitlement";
import { useOrgNameFromPathname } from "@/utils/useOrgNameFromPathname";
import { usePathnameWithoutOrgName } from "@/utils/usePathnameWithoutOrgName";
import { cn } from "@/utils/utils";
import { type BasepathTreeNode, type DocsSiteGroup, groupDocsSitesByDomain } from "./groupDocsSitesByDomain";

interface DocsSitesListProps {
    docsSitesData: DocsSiteData[];
    orgName: Auth0OrgName;
    multiRepoDomains: string[];
    onItemClick?: () => void;
}

function DocsSiteLink({
    site,
    currentOrgName,
    pathname,
    onItemClick
}: {
    site: DocsSiteData;
    currentOrgName: string;
    pathname: string;
    onItemClick?: () => void;
}) {
    const isSiteSelected = pathname === `/docs/${site.urlParam}` || pathname.startsWith(`/docs/${site.urlParam}/`);
    return (
        <Link
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
}

function DocsSiteGroupPopover({
    group,
    currentOrgName,
    pathname,
    onItemClick
}: {
    group: DocsSiteGroup;
    currentOrgName: string;
    pathname: string;
    onItemClick?: () => void;
}) {
    const isAnyChildSelected = group.sites.some((site) => {
        return pathname === `/docs/${site.urlParam}` || pathname.startsWith(`/docs/${site.urlParam}/`);
    });

    // Start collapsed unless a child is already selected
    const [isExpanded, setIsExpanded] = useState(isAnyChildSelected);

    const { rootSite, tree } = group;
    // Always have a navigable site for the domain header: prefer rootSite, fall back to first site
    const headerSite = rootSite ?? group.sites[0];
    const headerHref = headerSite != null ? `/${currentOrgName}/docs/${headerSite.urlParam}` : undefined;

    const headerClassName = cn(
        "flex items-center gap-2 px-3 py-2 text-sm rounded-md transition cursor-pointer",
        isAnyChildSelected
            ? "bg-green-50 dark:bg-green-900/20 text-primary font-medium"
            : "hover:bg-gray-100 dark:hover:bg-accent text-gray-900"
    );

    const domainLabel = (
        <TooltipProvider>
            <Tooltip content={group.domain} side="right">
                <div className="truncate">{group.domain}</div>
            </Tooltip>
        </TooltipProvider>
    );

    return (
        <div className="flex flex-col">
            <div className={headerClassName}>
                <button type="button" onClick={() => setIsExpanded(!isExpanded)} className="flex shrink-0 items-center">
                    <ChevronRightIcon className={cn("size-3 transition-transform", isExpanded && "rotate-90")} />
                </button>
                {headerHref != null ? (
                    <Link
                        href={headerHref}
                        className="flex min-w-0"
                        onClick={() => {
                            setIsExpanded(true);
                            onItemClick?.();
                        }}
                    >
                        {domainLabel}
                    </Link>
                ) : (
                    <button type="button" onClick={() => setIsExpanded(!isExpanded)} className="flex min-w-0">
                        {domainLabel}
                    </button>
                )}
            </div>
            {isExpanded && (
                <PopoverTreeItems
                    nodes={tree}
                    currentOrgName={currentOrgName}
                    pathname={pathname}
                    onItemClick={onItemClick}
                    depth={0}
                />
            )}
        </div>
    );
}

function PopoverTreeItems({
    nodes,
    currentOrgName,
    pathname,
    onItemClick,
    depth
}: {
    nodes: BasepathTreeNode[];
    currentOrgName: string;
    pathname: string;
    onItemClick?: () => void;
    depth: number;
}) {
    return (
        <>
            {nodes.map((node) => (
                <PopoverTreeNodeItem
                    key={node.site?.url ?? node.segment}
                    node={node}
                    currentOrgName={currentOrgName}
                    pathname={pathname}
                    onItemClick={onItemClick}
                    depth={depth}
                />
            ))}
        </>
    );
}

function PopoverTreeNodeItem({
    node,
    currentOrgName,
    pathname,
    onItemClick,
    depth
}: {
    node: BasepathTreeNode;
    currentOrgName: string;
    pathname: string;
    onItemClick?: () => void;
    depth: number;
}) {
    const site = node.site;
    const hasChildren = node.children.length > 0;
    const isSiteSelected = site
        ? pathname === `/docs/${site.urlParam}` || pathname.startsWith(`/docs/${site.urlParam}/`)
        : false;

    const isAnyDescendantSelected = hasChildren && isPopoverDescendantSelected(node.children, pathname);
    const [isExpanded, setIsExpanded] = useState(isSiteSelected || isAnyDescendantSelected);

    const label = `/${node.segment}`;
    const paddingLeft = `${2 + depth * 1}rem`;

    const itemClassName = cn(
        "flex items-center gap-2 py-1.5 pr-3 text-sm rounded-md transition",
        isSiteSelected
            ? "bg-green-50 dark:bg-green-900/20 text-primary font-medium"
            : "hover:bg-gray-100 dark:hover:bg-accent text-gray-900"
    );

    const nodeLabel = (
        <TooltipProvider>
            <Tooltip content={site?.url ?? label} side="right">
                <div className="truncate">{label}</div>
            </Tooltip>
        </TooltipProvider>
    );

    return (
        <div className="flex flex-col">
            <div className={itemClassName} style={{ paddingLeft }}>
                {hasChildren && (
                    <button
                        type="button"
                        onClick={() => setIsExpanded(!isExpanded)}
                        className="flex shrink-0 items-center"
                    >
                        <ChevronRightIcon className={cn("size-3 transition-transform", isExpanded && "rotate-90")} />
                    </button>
                )}
                {site ? (
                    <Link
                        href={`/${currentOrgName}/docs/${site.urlParam}`}
                        className="flex min-w-0"
                        onClick={() => {
                            if (hasChildren) {
                                setIsExpanded(true);
                            }
                            onItemClick?.();
                        }}
                    >
                        {nodeLabel}
                    </Link>
                ) : (
                    <div className="flex min-w-0">{nodeLabel}</div>
                )}
            </div>
            {hasChildren && isExpanded && (
                <PopoverTreeItems
                    nodes={node.children}
                    currentOrgName={currentOrgName}
                    pathname={pathname}
                    onItemClick={onItemClick}
                    depth={depth + 1}
                />
            )}
        </div>
    );
}

function isPopoverDescendantSelected(nodes: BasepathTreeNode[], pathname: string): boolean {
    for (const node of nodes) {
        if (node.site != null) {
            const href = `/docs/${node.site.urlParam}`;
            if (pathname === href || pathname.startsWith(`${href}/`)) {
                return true;
            }
        }
        if (node.children.length > 0 && isPopoverDescendantSelected(node.children, pathname)) {
            return true;
        }
    }
    return false;
}

export function DocsSitesList({ docsSitesData, orgName, multiRepoDomains, onItemClick }: DocsSitesListProps) {
    const currentOrgName = useOrgNameFromPathname();
    const pathname = usePathnameWithoutOrgName();
    const { openUpsell } = useUpsell();
    const { isEntitled } = useEntitlement("docs_sites");

    const multiRepoDomainsSet = new Set(multiRepoDomains);
    const groups = groupDocsSitesByDomain(docsSitesData, multiRepoDomainsSet);

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
            {groups.map((group) =>
                group.isMultiRepo ? (
                    <DocsSiteGroupPopover
                        key={group.domain}
                        group={group}
                        currentOrgName={currentOrgName}
                        pathname={pathname}
                        onItemClick={onItemClick}
                    />
                ) : (
                    group.sites.map((site) => (
                        <DocsSiteLink
                            key={site.url}
                            site={site}
                            currentOrgName={currentOrgName}
                            pathname={pathname}
                            onItemClick={onItemClick}
                        />
                    ))
                )
            )}
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
