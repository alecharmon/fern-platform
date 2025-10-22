"use client";

import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import React from "react";
import { useIsSidebarCollapsed, useToggleSidebarCollapse } from "@/state/sidebar-collapse";
import { cn } from "@/utils/utils";

export function NavbarCollapseToggle() {
    const [isCollapsed] = useIsSidebarCollapsed();
    const toggleCollapse = useToggleSidebarCollapse();
    const [isHovered, setIsHovered] = React.useState(false);

    const strokeColor = isHovered ? "var(--gray-1100)" : "var(--gray-900)";

    return (
        <button
            type="button"
            onClick={toggleCollapse}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            className={cn(
                "group hidden md:flex flex-col items-center gap-2 py-2 text-sm transition md:flex-row cursor-pointer",
                "text-gray-900 hover:text-gray-1100",
                isCollapsed && "md:justify-center"
            )}
            aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
            {isCollapsed ? (
                <PanelLeftOpen className="size-5 shrink-0" style={{ stroke: strokeColor }} />
            ) : (
                <>
                    <PanelLeftClose className="size-5 shrink-0" style={{ stroke: strokeColor }} />
                    <div>Collapse</div>
                </>
            )}
        </button>
    );
}
