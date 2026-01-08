"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useIsSidebarCollapsed } from "@/state/sidebar-collapse";
import { useOrgNameFromPathname } from "@/utils/useOrgNameFromPathname";
import { cn } from "@/utils/utils";

interface DocsNavbarSubItemProps {
    title: string;
    href: `/${string}`;
    urlParam: string;
}

export function DocsNavbarSubItem({ title, href, urlParam }: DocsNavbarSubItemProps) {
    const orgName = useOrgNameFromPathname();
    const params = useParams();
    const [isCollapsed] = useIsSidebarCollapsed();
    const isSelected = params.docsUrl ? urlParam === String(params.docsUrl) : false;

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
                <div className="truncate">{title}</div>
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
}
