"use client";

import Link from "next/link";
import { usePostHog } from "posthog-js/react";
import { useEffect, useMemo, useRef } from "react";

import { captureDocsTabViewed } from "@/components/posthog/events";
import { useOrgNameFromPathname } from "@/utils/useOrgNameFromPathname";
import { usePathnameWithoutOrgName } from "@/utils/usePathnameWithoutOrgName";
import { cn } from "@/utils/utils";

export interface NavItem {
    title: string;
    href: string;
}

const DOCS_PATHNAME_REGEX = /^(\/docs\/[^/]+)\/?([^/]*)\/?$/;

export function DocsSiteNavBarWithOverflow({
    items,
    siteHasGitHubAppInstalled,
    siteHasConnectedRepo
}: {
    items: NavItem[];
    siteHasGitHubAppInstalled?: boolean;
    siteHasConnectedRepo?: boolean;
}) {
    const orgName = useOrgNameFromPathname();
    const pathname = usePathnameWithoutOrgName();
    const posthog = usePostHog();
    const containerRef = useRef<HTMLDivElement>(null);
    const itemRefs = useRef<(HTMLElement | null)[]>([]);

    const { pathnameForDocsSite, tabPathname } = useMemo(() => {
        const match = DOCS_PATHNAME_REGEX.exec(pathname);
        const pathnameForDocsSite = match?.[1];
        const tabPathname = match?.[2];
        if (pathnameForDocsSite == null || tabPathname == null) {
            throw new Error(`Failed to parse tab pathname (pathname=${pathname})`);
        }
        return { pathnameForDocsSite, tabPathname };
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
                siteHasGitHubAppInstalled: siteHasGitHubAppInstalled ?? false,
                siteHasConnectedRepo: siteHasConnectedRepo ?? false
            });
        }
    }, [items, tabPathname, posthog, siteHasGitHubAppInstalled, siteHasConnectedRepo]);

    const renderNavItem = (item: NavItem, index: number) => {
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
            return (
                <Link
                    key={index}
                    ref={(el) => {
                        itemRefs.current[index] = el;
                    }}
                    className={className}
                    href={`/${orgName}${pathnameForDocsSite}/${item.href}`}
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
        <div className="relative md:hidden">
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
