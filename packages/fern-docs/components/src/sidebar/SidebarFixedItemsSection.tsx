"use client";

import { useIsMobile } from "@fern-ui/react-commons";
import { Fragment } from "react";

import { cn } from "../cn";
import { useIsSidebarCollapsed } from "../state/sidebar-collapse";

export function SidebarFixedItemsSection({
    logo,
    versionSelect,
    productSelect,
    className,
    showSearchBar,
    showHeaderInSidebar,
    searchBar
}: {
    logo: React.ReactNode;
    versionSelect: React.ReactNode;
    productSelect: React.ReactNode;
    showBorder?: boolean;
    showSearchBar?: boolean;
    searchBar?: React.ReactNode;
    showHeaderInSidebar?: boolean;
    className?: string;
}) {
    const isMobile = useIsMobile();
    const [isCollapsed] = useIsSidebarCollapsed();

    if (isMobile) {
        return null;
    }
    if (!showHeaderInSidebar && !showSearchBar) {
        return null;
    }
    return (
        <div className={cn("flex flex-col px-4 pt-2 lg:pl-5 transition-all duration-300", className)}>
            {showHeaderInSidebar && (
                <>
                    <div className="fern-sidebar-header">
                        <div
                            className={cn(
                                "relative flex h-full min-w-fit flex-1 shrink-0 items-center gap-2 py-1",
                                isCollapsed && "justify-center"
                            )}
                        >
                            <div className={cn("flex items-center gap-2", isCollapsed && "scale-90")}>{logo}</div>
                        </div>
                    </div>
                    {!isCollapsed && (
                        <>
                            <Fragment key="product-select">{productSelect}</Fragment>
                            <Fragment key="version-select">{versionSelect}</Fragment>
                        </>
                    )}
                </>
            )}
            {!isCollapsed && searchBar}
        </div>
    );
}
