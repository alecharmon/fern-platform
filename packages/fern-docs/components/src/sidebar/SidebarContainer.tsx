"use client";

import React from "react";
import { cn } from "../cn";
import { FERN_SIDEBAR_SCROLL_AREA_ID } from "../constants";
import { FernScrollArea } from "../FernScrollArea";
import { ThemeSwitch } from "../header/theme-switch";
import { useDismountMeasureSidebarScrollPosition } from "../hooks/sidebar-scroll";
import { MobileSidebarHeaderLinks } from "./MobileSidebarHeaderLinks";
import { SidebarFixedItemsSection } from "./SidebarFixedItemsSection";

export const SidebarContainer = React.memo(function SidebarContainer({
    logo,
    productSelect,
    versionSelect,
    languageSelect,
    navbarLinks,
    loginButton,
    children,
    showSearchBar,
    showHeaderInSidebar,
    searchBar,
    lang
}: {
    showSearchBar: boolean;
    showHeaderInSidebar: boolean;
    logo: React.ReactNode;
    productSelect: React.ReactNode;
    versionSelect: React.ReactNode;
    languageSelect?: React.ReactNode;
    navbarLinks: React.ReactNode;
    loginButton: React.ReactNode;
    searchBar: React.ReactNode;
    children: React.ReactNode;
    lang: string;
}) {
    const ref = React.useRef<HTMLDivElement>(null);
    useDismountMeasureSidebarScrollPosition(ref);

    return (
        <>
            <SidebarFixedItemsSection
                logo={logo}
                productSelect={productSelect}
                versionSelect={versionSelect}
                showSearchBar={showSearchBar}
                searchBar={searchBar}
                showHeaderInSidebar={showHeaderInSidebar}
            />
            <FernScrollArea
                id={FERN_SIDEBAR_SCROLL_AREA_ID}
                rootClassName="flex-1"
                className="group/sidebar mask-grad-y-3 sticky overscroll-contain [&>div]:space-y-6"
                scrollbars="vertical"
                ref={ref}
            >
                <React.Fragment key="login-button">{loginButton}</React.Fragment>
                {children}
                <MobileSidebarHeaderLinks hideInDesktop={!showHeaderInSidebar} key="mobile-sidebar-header-links">
                    {navbarLinks}
                    {languageSelect}
                </MobileSidebarHeaderLinks>
                <ThemeSwitch
                    className={cn("mx-auto mt-8 flex", !showHeaderInSidebar && "lg:hidden")}
                    key="theme-switch"
                    lang={lang}
                />
            </FernScrollArea>
        </>
    );
});
