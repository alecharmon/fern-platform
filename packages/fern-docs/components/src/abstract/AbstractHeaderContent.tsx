"use client";

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
    showSwitcher,
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
    showSwitcher?: boolean;
    navbarLinks: React.ReactNode;
    loginButton?: React.ReactNode;
    forceHeader?: boolean;
    searchBar: React.ReactNode;
    themeSwitch: React.ReactNode;
    headerDisabled?: boolean;
}) {
    return (
        <div className={cn("flex w-full flex-col items-center justify-stretch gap-4", className)}>
            <div className={cn("flex w-full items-center justify-stretch gap-4", className)} style={style}>
                <div className="fern-header-logo-container">
                    <div className="flex items-center gap-2">
                        <div className="flex items-center lg:items-start">{logo}</div>
                        {showSwitcher && (
                            <div className="hidden lg:flex items-baseline">
                                {productSelect}
                                {versionSelect}
                            </div>
                        )}
                    </div>
                </div>

                {!headerDisabled && (
                    <div className={cn(showSearchBar ? "contents" : "contents lg:hidden")}>{searchBar}</div>
                )}

                <FernButtonGroup asChild>
                    <nav className="fern-header-navbar-links hidden lg:flex" aria-label="Navbar links">
                        {navbarLinks}
                        {loginButton}
                        {languageSelect}
                        {themeSwitch}
                    </nav>
                </FernButtonGroup>

                <div className="fern-header-mobile-menu-button lg:hidden">
                    <MobileMenuButton />
                </div>
            </div>
        </div>
    );
}
