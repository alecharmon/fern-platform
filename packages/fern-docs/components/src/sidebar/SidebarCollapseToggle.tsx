"use client";

import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import React from "react";
import { cn } from "../cn";
import { useIsSidebarCollapsed, useToggleSidebarCollapse } from "../state/sidebar-collapse";

export const SidebarCollapseToggle = React.memo(function SidebarCollapseToggle({ className }: { className?: string }) {
    const [isCollapsed] = useIsSidebarCollapsed();
    const toggleCollapse = useToggleSidebarCollapse();

    return (
        <button
            type="button"
            onClick={toggleCollapse}
            className={cn("fern-sidebar-link", "w-full", isCollapsed && "justify-center", className)}
            aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
            {isCollapsed ? (
                <PanelLeftOpen className="size-icon shrink-0" />
            ) : (
                <>
                    <PanelLeftClose className="size-icon shrink-0" />
                    <span className="fern-sidebar-link-title">Collapse</span>
                </>
            )}
        </button>
    );
});
