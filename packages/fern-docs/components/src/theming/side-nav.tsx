"use client";

import React from "react";
import { cn } from "../cn";
import { FERN_SIDEBAR_ID, FERN_SIDEBAR_SPACER_ID } from "../constants";
import { MobileMenu } from "./mobile-menu";

export function SidebarNav({
    children,
    className,
    mobileClassName,
    desktopClassName,
    fixed,
    isSidePanelOpen,
    ...props
}: {
    children: React.ReactNode;
    className?: string;
    mobileClassName?: string;
    desktopClassName?: string;
    fixed?: boolean;
    "data-theme"?: string;
    isSidePanelOpen?: boolean;
}) {
    // MobileMenu uses document.getElementById in motion hooks (useTransform, useMotionValueEvent)
    // which causes "document is not defined" errors during SSR. Only render after hydration.
    const [isClient, setIsClient] = React.useState(false);
    React.useEffect(() => {
        setIsClient(true);
    }, []);

    // Use CSS-based responsive visibility instead of useIsDesktop() to avoid hydration mismatch
    // and prevent component remounting when crossing viewport breakpoints
    return (
        <>
            {/* Desktop sidebar - hidden on mobile via CSS */}
            <DesktopMenu className={cn(className, desktopClassName, "fern-sidebar-desktop")} fixed={fixed} {...props}>
                {children}
            </DesktopMenu>

            {/* Mobile sidebar drawer - only render on client due to document API usage */}
            {isClient && (
                <MobileMenu className={cn(className, mobileClassName)} isSidePanelOpen={isSidePanelOpen} {...props}>
                    {children}
                </MobileMenu>
            )}
        </>
    );
}

function DesktopMenu({
    children,
    className,
    hidden,
    fixed
}: {
    children: React.ReactNode;
    className?: string;
    hidden?: boolean;
    fixed?: boolean;
}) {
    if (hidden) {
        return null;
    }
    return (
        <>
            <aside
                id={FERN_SIDEBAR_ID}
                data-viewport="desktop"
                data-state={fixed ? "fixed" : "sticky"}
                className={className}
            >
                {children}
            </aside>
            {fixed && <aside id={FERN_SIDEBAR_SPACER_ID} />}
        </>
    );
}
