"use client";

import { MoreHorizontal } from "lucide-react";
import React, { useEffect, useRef, useState } from "react";

import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

export function NavbarWithOverflow({ children }: { children: React.ReactNode }) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [mounted, setMounted] = useState(false);
    const [isMobile, setIsMobile] = useState(false);
    const [visibleCount, setVisibleCount] = useState(99);

    useEffect(() => {
        setMounted(true);

        const calculateVisibleItems = () => {
            const mobile = window.matchMedia("(max-width: 767px)").matches;
            setIsMobile(mobile);

            if (!containerRef.current || !mobile) {
                setVisibleCount(99);
                return;
            }

            setVisibleCount(3);
        };

        calculateVisibleItems();
        window.addEventListener("resize", calculateVisibleItems);
        return () => {
            window.removeEventListener("resize", calculateVisibleItems);
        };
    }, []);

    const childArray = React.Children.toArray(children);

    const effectiveMobile = mounted && isMobile;

    const mobileVisibleChildren = effectiveMobile
        ? childArray.filter((child) => {
              if (!React.isValidElement(child)) {
                  return true;
              }
              const className = typeof child.props.className === "string" ? child.props.className : "";
              return !className.includes("hidden md:flex");
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
