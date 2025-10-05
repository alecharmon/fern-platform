"use client";

import type { CSSProperties } from "react";
import type React from "react";

import { AbstractHeaderContent } from "@fern-docs/components/abstract/AbstractHeaderContent";
import { ThemeSwitch } from "@fern-docs/components/header/theme-switch";

import { SearchV2Trigger } from "@/state/search";
import { useIsAskAiEnabled } from "@/state/search";
import { SearchPanelTrigger } from "@/state/search-panel";

export function HeaderContent({
    logo,
    versionSelect,
    productSelect,
    className,
    style,
    showSearchBar,
    navbarLinks,
    loginButton,
    forceHeader = false,
    headerDisabled = false
}: {
    logo: React.ReactNode;
    versionSelect: React.ReactNode;
    productSelect: React.ReactNode;
    className?: string;
    style?: CSSProperties;
    showSearchBar?: boolean;
    navbarLinks: React.ReactNode;
    loginButton?: React.ReactNode;
    forceHeader?: boolean;
    headerDisabled?: boolean;
}) {
    const isAskAiEnabled = useIsAskAiEnabled();
    return (
        <AbstractHeaderContent
            className={className}
            style={style}
            logo={logo}
            versionSelect={versionSelect}
            productSelect={productSelect}
            navbarLinks={navbarLinks}
            loginButton={loginButton}
            forceHeader={forceHeader}
            showSearchBar={showSearchBar}
            headerDisabled={headerDisabled}
            searchBar={
                <div className="flex w-full max-w-[640px] flex-row gap-2">
                    <SearchV2Trigger
                        aria-label="Search"
                        className="fern-header-search-bar flex-1 overflow-hidden"
                        isSearchInSidebar={false}
                    />
                    {isAskAiEnabled && <SearchPanelTrigger aria-label="Ask AI" />}
                </div>
            }
            themeSwitch={<ThemeSwitch iconOnly variant="ghost" className="ml-2" />}
        />
    );
}
