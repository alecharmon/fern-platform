"use client";

import Link from "next/link";
import { memo } from "react";
import { Tooltip, TooltipProvider } from "@/components/ui/tooltip";
import { useIsSidebarCollapsed } from "@/state/sidebar-collapse";
import { useOrgNameFromPathname } from "@/utils/useOrgNameFromPathname";
import { usePathnameWithoutOrgName } from "@/utils/usePathnameWithoutOrgName";
import { cn } from "@/utils/utils";

interface DocsNavbarSubItemProps {
    title: string;
    href: `/${string}`;
    urlParam: string;
}

export const DocsNavbarSubItem = memo(function DocsNavbarSubItem({ title, href, urlParam }: DocsNavbarSubItemProps) {
    const orgName = useOrgNameFromPathname();
    const pathname = usePathnameWithoutOrgName();
    const [isCollapsed] = useIsSidebarCollapsed();
    // Use pathname matching instead of useParams().docsUrl for robust highlighting
    // with PPR/cacheComponents (useParams can return stale values in parallel routes).
    const isSelected = pathname === href || pathname.startsWith(`${href}/`);

    // Don't render sub-items when collapsed (they're in the popover instead)
    if (isCollapsed) {
        return null;
    }

    const className = cn(
        "hidden md:flex",
        "flex-1 flex-row gap-2 text-sm transition",
        isSelected ? "text-primary" : "hover:text-gray-1100 text-gray-900"
    );

    const children = (
        <>
            <div className="flex w-5 shrink-0 justify-center">
                <div className={cn("w-px", isSelected ? "bg-green-1100" : "bg-gray-700")} />
            </div>
            <div className="flex min-w-0 items-center py-2 pr-4">
                <TooltipProvider>
                    <Tooltip content={title} side="right">
                        <div className="truncate">{title}</div>
                    </Tooltip>
                </TooltipProvider>
            </div>
        </>
    );

    if (isSelected) {
        return <div className={className}>{children}</div>;
    }

    return (
        <Link href={`/${orgName}${href}`} className={className}>
            {children}
        </Link>
    );
});
