"use client";

import { MoreHorizontal } from "lucide-react";
import React, { useRef } from "react";

import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { MEDIA_QUERIES, useMediaQuery } from "@/hooks/use-media-query";

export function NavbarWithOverflow({ children }: { children: React.ReactNode }) {
    const containerRef = useRef<HTMLDivElement>(null);
    const isMobile = useMediaQuery(MEDIA_QUERIES.mobile);

    const childArray = React.Children.toArray(children);

    // isMobile is undefined during SSR, treat as false (not mobile)
    const effectiveMobile = isMobile === true;

    const mobileVisibleChildren = effectiveMobile
        ? childArray.filter((child) => {
              if (!React.isValidElement(child)) {
                  return true;
              }
              const props = child.props as { className?: string };
              return !props.className?.includes("hidden md:flex");
          })
        : childArray;

    const visibleItems = effectiveMobile ? mobileVisibleChildren.slice(0, 3) : mobileVisibleChildren;
    const overflowItems = effectiveMobile ? mobileVisibleChildren.slice(3) : [];

    return (
        <div ref={containerRef} className="flex gap-6 overflow-y-auto px-8 md:flex-col md:gap-0 md:px-0 md:pb-4">
            {visibleItems}
            {effectiveMobile && overflowItems.length > 0 && (
                <DropdownMenu>
                    <DropdownMenuTrigger className="overflow-menu-trigger group flex flex-1 flex-col items-center gap-2 py-2 text-sm transition text-gray-900 hover:text-gray-1100 focus:ring-0 px-2 md:hidden">
                        <MoreHorizontal className="size-5" />
                        <div>More</div>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                        align="end"
                        className="md:hidden [&_a]:!flex-row [&_a]:!px-2 [&_a]:!items-start [&_a]:flex-[0] [&_div.group]:!flex-row [&_div.group]:!px-2 [&_div.group]:!items-start [&_div.group]:flex-[0]"
                    >
                        {overflowItems}
                    </DropdownMenuContent>
                </DropdownMenu>
            )}
        </div>
    );
}
