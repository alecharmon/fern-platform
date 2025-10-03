"use client";

import { useIsDesktop } from "@fern-ui/react-commons";

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
    const isDesktop = useIsDesktop();

    if (isDesktop) {
        return (
            <DesktopMenu className={cn(className, desktopClassName)} fixed={fixed} {...props}>
                {children}
            </DesktopMenu>
        );
    }

    return (
        <MobileMenu
            className={cn(className, mobileClassName, { hidden: isDesktop })}
            isSidePanelOpen={isSidePanelOpen}
            {...props}
        >
            {children}
        </MobileMenu>
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
