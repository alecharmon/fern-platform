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
                        {/* Desktop only: product/version selectors - use CSS to avoid hydration mismatch */}
                        {showSwitcher && (
                            <div className="fern-header-selectors">
                                {productSelect}
                                {versionSelect}
                            </div>
                        )}
                    </div>
                </div>

                {/* Search bar: always render, CSS controls visibility
                    - On mobile: always visible (Ask AI button shows, Search button hidden via its own CSS)
                    - On desktop: visible only if showSearchBar is true */}
                {!headerDisabled && (
                    <div
                        className={cn(
                            // Match searchBar's sizing: w-full up to 640px max
                            // This makes wrapper behave like searchBar would as a direct flex child
                            "w-full max-w-[640px]",
                            !showSearchBar && "lg:hidden"
                        )}
                    >
                        {searchBar}
                    </div>
                )}

                {/* Desktop navbar */}
                <FernButtonGroup asChild>
                    <nav className="fern-header-navbar-links hidden lg:flex" aria-label="Navbar links">
                        {navbarLinks}
                        {loginButton}
                        {languageSelect}
                        {themeSwitch}
                    </nav>
                </FernButtonGroup>

                {/* Mobile menu button */}
                <div className="fern-header-mobile-menu-button lg:hidden">
                    <MobileMenuButton />
                </div>
            </div>
        </div>
    );
}
