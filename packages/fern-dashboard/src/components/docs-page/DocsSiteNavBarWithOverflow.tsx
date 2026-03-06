"use client";

import type { AuthZPermission } from "@fern-api/user-permissions";
import Link from "next/link";
import { usePostHog } from "posthog-js/react";
import { useEffect, useMemo, useRef } from "react";
import { captureDocsTabViewed } from "@/components/posthog/events";
import { useAuthZ } from "@/hooks/useAuthZ";
import { useOrgNameFromPathname } from "@/utils/useOrgNameFromPathname";
import { usePathnameWithoutOrgName } from "@/utils/usePathnameWithoutOrgName";
import { cn } from "@/utils/utils";

export interface NavItem {
    title: string;
    href: string;
    permission?: AuthZPermission;
}

const DOCS_PATHNAME_REGEX = /^(\/docs\/([^/]+))\/?([^/]*)\/?$/;

export function DocsSiteNavBarWithOverflow({
    items,
    siteHasConnectedRepo
}: {
    items: NavItem[];
    siteHasConnectedRepo?: boolean;
}) {
    const orgName = useOrgNameFromPathname();
    const pathname = usePathnameWithoutOrgName();
    const posthog = usePostHog();
    const containerRef = useRef<HTMLDivElement>(null);
    const itemRefs = useRef<(HTMLElement | null)[]>([]);
    const authZ = useAuthZ(orgName);

    const { pathnameForDocsSite, docsSiteId, tabPathname } = useMemo(() => {
        const match = DOCS_PATHNAME_REGEX.exec(pathname);
        const pathnameForDocsSite = match?.[1];
        const docsSiteId = match?.[2];
        const tabPathname = match?.[3];
        if (pathnameForDocsSite == null || docsSiteId == null || tabPathname == null) {
            throw new Error(`Failed to parse tab pathname (pathname=${pathname})`);
        }
        return { pathnameForDocsSite, docsSiteId, tabPathname };
    }, [pathname]);

    useEffect(() => {
        const selectedIndex = items.findIndex((item) => item.href === tabPathname);
        if (selectedIndex !== -1 && itemRefs.current[selectedIndex] && containerRef.current) {
            const selectedElement = itemRefs.current[selectedIndex];
            if (selectedElement) {
                selectedElement.scrollIntoView({
                    behavior: "smooth",
                    block: "nearest",
                    inline: "center"
                });
            }
        }
    }, [items, tabPathname]);

    useEffect(() => {
        const selectedItem = items.find((item) => item.href === tabPathname);
        if (selectedItem) {
            captureDocsTabViewed(posthog, {
                tab: selectedItem.title,
                siteHasGitHubAppInstalled: siteHasConnectedRepo ?? false,
                siteHasConnectedRepo: siteHasConnectedRepo ?? false
            });
        }
    }, [items, tabPathname, posthog, siteHasConnectedRepo]);

    const hasPermission = (permission: AuthZPermission | undefined): boolean => {
        if (permission == null) {
            return true;
        }
        if (authZ.type !== "loaded") {
            return false; // Hide while loading
        }
        return authZ.value.hasResource(permission, "docs", docsSiteId);
    };

    const renderNavItem = (item: NavItem, index: number) => {
        // Hide items that require permission the user doesn't have
        if (!hasPermission(item.permission)) {
            return null;
        }

        const isSelected = tabPathname === item.href;
        const isClickable = !isSelected;

        const className = cn(
            "flex flex-col pl-4 pr-4 transition first:pl-0",
            isSelected ? "text-gray-1100" : "text-gray-900",
            isClickable && "hover:text-gray-1100"
        );

        const children = (
            <>
                <div className="flex pb-3 whitespace-nowrap">{item.title}</div>
                {isSelected && <div className="bg-gray-1100 h-0.5 rounded-full dark:bg-gray-700" />}
            </>
        );

        if (isClickable) {
            const tabHref = `/${orgName}${pathnameForDocsSite}/${item.href}`;
            return (
                <Link
                    key={index}
                    ref={(el) => {
                        itemRefs.current[index] = el;
                    }}
                    className={className}
                    href={tabHref}
                    prefetch={true}
                >
                    {children}
                </Link>
            );
        }

        return (
            <div
                key={index}
                ref={(el) => {
                    itemRefs.current[index] = el;
                }}
                className={className}
            >
                {children}
            </div>
        );
    };

    return (
        <div className="relative">
            <div ref={containerRef} className="flex items-center overflow-x-auto">
                {items.map((item, index) => renderNavItem(item, index))}
            </div>
            <div
                className="absolute right-0 top-0 h-full w-8 pointer-events-none"
                style={{
                    background: "linear-gradient(to right, transparent, var(--gray-100))"
                }}
            />
        </div>
    );
}
