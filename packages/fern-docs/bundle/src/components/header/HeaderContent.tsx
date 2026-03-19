"use client";

import { AbstractHeaderContent } from "@fern-docs/components/abstract/AbstractHeaderContent";
import { ThemeSwitch } from "@fern-docs/components/header/theme-switch";
import { t } from "@fern-docs/i18n";
import type React from "react";
import type { CSSProperties } from "react";
import { SearchV2Trigger, useIsAskAiEnabled } from "@/state/search";
import { SearchPanelTrigger } from "@/state/search-panel";

export function HeaderContent({
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
    headerDisabled = false,
    placeholder,
    lang
}: {
    logo: React.ReactNode;
    versionSelect: React.ReactNode;
    productSelect: React.ReactNode;
    languageSelect: React.ReactNode;
    className?: string;
    style?: CSSProperties;
    showSearchBar?: boolean;
    showSwitcher?: boolean;
    navbarLinks: React.ReactNode;
    loginButton?: React.ReactNode;
    headerDisabled?: boolean;
    placeholder?: string;
    lang: string;
}) {
    const isAskAiEnabled = useIsAskAiEnabled();
    const searchPlaceholder = placeholder ?? t(lang).search.search;
    return (
        <AbstractHeaderContent
            className={className}
            style={style}
            logo={logo}
            versionSelect={versionSelect}
            productSelect={productSelect}
            languageSelect={languageSelect}
            navbarLinks={navbarLinks}
            loginButton={loginButton}
            showSearchBar={showSearchBar}
            showSwitcher={showSwitcher}
            headerDisabled={headerDisabled}
            searchBar={
                <div className="flex w-full max-w-[640px] flex-row gap-2">
                    <SearchV2Trigger
                        aria-label={t(lang).search.search}
                        className="fern-header-search-bar flex-1 overflow-hidden"
                        isSearchInSidebar={false}
                        placeholder={searchPlaceholder}
                        lang={lang}
                    />
                    {isAskAiEnabled && <SearchPanelTrigger aria-label={t(lang).search.askAI} lang={lang} />}
                </div>
            }
            themeSwitch={<ThemeSwitch iconOnly variant="ghost" className="ml-2" lang={lang} />}
        />
    );
}
