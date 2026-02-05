"use client";

import { useTheme } from "next-themes";
import React, { Fragment } from "react";
import { cn } from "../cn";
import { FERN_FOOTER_ID, FERN_HEADER_ID } from "../constants";
import { useHasCustomFooter } from "../hooks/useHasCustomFooter";
import { Separator } from "../Separator";
import { useIsEmbedded } from "../state/embedded";
import { FernHeader } from "./fern-header";
import { MainCtx } from "./mobile-menu";
import { SidebarNav } from "./side-nav";

export default function AbstractDefaultDocs({
    header,
    versionSelect,
    productSelect,
    sidebar,
    children,
    announcement,
    headerTabs,
    hasProductsOrVersions = false,
    isSidebarFixed = false,
    isHeaderDisabled = false,
    lightHeaderClassName,
    darkHeaderClassName,
    lightSidebarClassName,
    darkSidebarClassName,
    isSidePanelOpen = false,
    isSidePanelResizing = false,
    customHeader,
    customFooter
}: {
    header: React.ReactNode;
    versionSelect?: React.ReactNode;
    productSelect?: React.ReactNode;
    sidebar: React.ReactNode;
    children: React.ReactNode;
    announcement?: React.ReactNode;
    headerTabs?: React.ReactNode;
    hasProductsOrVersions?: boolean;
    isSidebarFixed?: boolean;
    isHeaderDisabled?: boolean;
    lightHeaderClassName?: string;
    darkHeaderClassName?: string;
    lightSidebarClassName?: string;
    darkSidebarClassName?: string;
    isSidePanelOpen?: boolean;
    isSidePanelResizing?: boolean;
    customHeader?: React.ReactNode;
    customFooter?: React.ReactNode;
}) {
    const { resolvedTheme } = useTheme();
    const isEmbedded = useIsEmbedded();
    const hasCustomFooter = useHasCustomFooter();
    const headerClassName = resolvedTheme === "dark" ? darkHeaderClassName : lightHeaderClassName;
    const sidebarClassName = resolvedTheme === "dark" ? darkSidebarClassName : lightSidebarClassName;
    const mainRef = React.useRef<HTMLDivElement>(null);

    // Use sticky positioning when there's a custom footer to prevent overlap
    // Fixed positioning is used when there's no custom footer (existing behavior)
    const shouldUseFixedSidebar = isSidebarFixed && !hasCustomFooter;

    React.useEffect(() => {
        if (typeof document !== "undefined") {
            if (isSidePanelOpen) {
                document.documentElement.style.setProperty("--page-margin", "0px");
            } else {
                document.documentElement.style.removeProperty("--page-margin");
            }
        }
    }, [isSidePanelOpen]);
    return (
        <div
            className={cn("transition-all duration-500 ease-out", isSidePanelResizing && "!transition-none")}
            style={{
                marginRight: isSidePanelOpen ? "var(--ask-ai-panel-width, 24rem)" : "0"
            }}
        >
            <div className="fern-background-image pointer-events-none fixed inset-0" />
            {!isEmbedded && customHeader != null ? (
                <header id={FERN_HEADER_ID} className="width-before-scroll-bar" data-theme="default">
                    {customHeader}
                    <Fragment key="header-tabs">{headerTabs}</Fragment>
                </header>
            ) : (
                !isEmbedded && (
                    <FernHeader
                        className={cn(
                            "fern-background-image transition-all duration-500 ease-out",
                            { "lg:hidden": isHeaderDisabled },
                            isSidePanelResizing && "!transition-none",
                            headerClassName
                        )}
                        style={{
                            width: isSidePanelOpen ? "calc(100% - var(--ask-ai-panel-width, 24rem))" : "100%"
                        }}
                        data-theme="default"
                    >
                        {announcement}
                        <div className="width-before-scroll-bar">
                            <div className="fern-header-content">{header}</div>
                            <Fragment key="header-tabs">{headerTabs}</Fragment>
                        </div>
                    </FernHeader>
                )
            )}

            <MainCtx.Provider value={mainRef}>
                <main
                    ref={mainRef}
                    className={cn(
                        "relative z-0 flex transition-all duration-500 ease-out",
                        !isEmbedded && "mt-(--header-height)",
                        {
                            "mx-auto": isSidePanelOpen
                        }
                    )}
                    style={{
                        maxWidth: isSidePanelOpen ? "calc(var(--page-width) + 3rem)" : "inherit",
                        transition: "max-width 500ms ease-out"
                    }}
                    data-theme="default"
                >
                    <SidebarNav
                        className={cn(
                            sidebarClassName,
                            isSidePanelOpen && "w-[var(--spacing-sidebar-width)]",
                            // !isSidePanelOpen && "transition-all duration-500 ease-out",
                            isSidePanelResizing && "!transition-none"
                        )}
                        data-theme="default"
                        fixed={shouldUseFixedSidebar}
                        isSidePanelOpen={isSidePanelOpen}
                    >
                        <div
                            key="product-select-version-select"
                            className={cn("fern-header-switchers px-2 py-4 lg:hidden", {
                                hidden: !hasProductsOrVersions
                            })}
                        >
                            {productSelect}
                            {versionSelect}
                        </div>
                        <Separator
                            key="separator"
                            className={cn("bg-border-concealed lg:hidden", {
                                hidden: !hasProductsOrVersions
                            })}
                        />
                        {sidebar}
                    </SidebarNav>
                    {children}
                </main>
            </MainCtx.Provider>

            {!isEmbedded && (
                <footer
                    id={FERN_FOOTER_ID}
                    className={cn(customFooter != null && "relative", "width-before-scroll-bar")}
                >
                    {customFooter}
                </footer>
            )}
        </div>
    );
}
