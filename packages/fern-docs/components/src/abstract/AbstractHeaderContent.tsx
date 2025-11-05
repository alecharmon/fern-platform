"use client";

import { useIsDesktop } from "@fern-ui/react-commons";
import type React from "react";
import type { CSSProperties } from "react";
import { cn } from "../cn";
import { FernButtonGroup } from "../FernButton";
import { MobileMenuButton } from "../header/MobileButtons";

export function AbstractHeaderContent({
    logo,
    versionSelect,
    productSelect,
    languageSelect,
    className,
    style,
    showSearchBar,
    navbarLinks,
    loginButton,
    forceHeader = false,
    searchBar,
    themeSwitch,
    headerDisabled = false
}: {
    logo: React.ReactNode;
    versionSelect: React.ReactNode;
    productSelect: React.ReactNode;
    languageSelect?: React.ReactNode;
    className?: string;
    style?: CSSProperties;
    showSearchBar?: boolean;
    navbarLinks: React.ReactNode;
    loginButton?: React.ReactNode;
    forceHeader?: boolean;
    searchBar: React.ReactNode;
    themeSwitch: React.ReactNode;
    headerDisabled?: boolean;
}) {
    const isDesktop = useIsDesktop();
    return (
        <div className={cn("flex w-full flex-col items-center justify-stretch gap-4", className)}>
            <div className={cn("flex w-full items-center justify-stretch gap-4", className)} style={style}>
                <div className="fern-header-logo-container">
                    <div className="flex items-center gap-2">
                        <div className="flex items-center lg:items-start">{logo}</div>
                        <div
                            className={cn("items-baseline lg:flex", {
                                hidden: !forceHeader,
                                flex: forceHeader
                            })}
                        >
                            {productSelect}
                            {versionSelect}
                            {languageSelect}
                        </div>
                    </div>
                </div>

                {(showSearchBar || !isDesktop) && !headerDisabled && searchBar}

                {isDesktop && (
                    <FernButtonGroup asChild>
                        <nav className="fern-header-navbar-links" aria-label="Navbar links">
                            {navbarLinks}
                            {loginButton}
                            {themeSwitch}
                        </nav>
                    </FernButtonGroup>
                )}

                {!isDesktop && (
                    <div className="fern-header-mobile-menu-button">
                        <MobileMenuButton />
                    </div>
                )}
            </div>
        </div>
    );
}
