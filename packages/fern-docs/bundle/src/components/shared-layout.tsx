import "server-only";

import type { DocsLoader } from "@fern-api/docs-server/docs-loader";
import { isLocal } from "@fern-api/docs-server/isLocal";
import { logger } from "@fern-api/ui-core-utils/logger";
import { cn } from "@fern-docs/components/cn";
import { MobileMenuButton } from "@fern-docs/components/header/MobileButtons";
import { NavbarLinks } from "@fern-docs/components/header/NavbarLinks";
import { ThemeSwitch } from "@fern-docs/components/header/theme-switch";
import { SidebarContainer } from "@fern-docs/components/sidebar/SidebarContainer";
import { t } from "@fern-docs/i18n";
import React from "react";
import type { FernComponentNodes } from "@/components/custom-component";
import { CustomComponent } from "@/components/custom-component";
import { compileTsx } from "@/components/custom-component/compile-tsx";
import { HeaderContent } from "@/components/header/HeaderContent";
import { ThemedDocs } from "@/components/themes/ThemedDocs";
import { SearchV2Trigger } from "@/state/search";
import { SearchPanelTrigger } from "@/state/search-panel";
import { LoginButton } from "./login-button";

export default async function SharedLayout({
    children,
    headertabs,
    sidebar,
    versionSelect,
    productSelect,
    languageSelect,
    loader,
    logo,
    announcement
}: {
    children: React.ReactNode;
    headertabs: React.ReactNode;
    sidebar?: React.ReactNode;
    versionSelect: React.ReactNode;
    productSelect: React.ReactNode;
    languageSelect: React.ReactNode;
    loader: DocsLoader & {
        clearKvCache: () => Promise<void>;
        isAskAiEnabledForDocs: () => Promise<boolean>;
    };
    logo: React.ReactNode;
    announcement?: React.ReactNode;
}) {
    const isLocalEnvironment = isLocal();
    const [config, settings, colors, layout, root, lang, isAskAiEnabled, jsFiles] = await Promise.all([
        loader.getConfig(),
        loader.getSettings(),
        loader.getColors(),
        loader.getLayout(),
        loader.getRoot(),
        loader.getLanguage(),
        loader.isAskAiEnabledForDocs(),
        loader.getMdxBundlerFiles()
    ]);
    const theme = "default";

    // Look up and compile custom header component from jsFiles
    // config.header contains the relative file path (e.g., "docs/components/CustomHeader.tsx")
    // The actual source code is stored in jsFiles keyed by the same path
    // Note: Custom footer is also compiled here and passed to ThemedDocs
    let compiledHeaderCode: string | undefined;
    let compiledFooterCode: string | undefined;

    if (config.header != null) {
        const headerSource = jsFiles[config.header];
        if (headerSource != null) {
            try {
                compiledHeaderCode = await compileTsx(headerSource, config.header);
            } catch (err) {
                logger.error("[SharedLayout] Failed to compile custom header:", err);
            }
        } else {
            logger.warn(`[SharedLayout] Custom header path "${config.header}" not found in jsFiles`);
        }
    }

    if (config.footer != null) {
        const footerSource = jsFiles[config.footer];
        if (footerSource != null) {
            try {
                compiledFooterCode = await compileTsx(footerSource, config.footer);
            } catch (err) {
                logger.error("[SharedLayout] Failed to compile custom footer:", err);
            }
        } else {
            logger.warn(`[SharedLayout] Custom footer path "${config.footer}" not found in jsFiles`);
        }
    }

    const headerSource = config.header != null ? jsFiles[config.header] : undefined;
    const customHeaderUsesTabs = headerSource != null && /Fern\s*\.\s*Tabs/.test(headerSource);

    const hasProductsOrVersions = root.child.type === "productgroup" || root.child.type === "versioned";
    const showHeaderInSidebar = layout.isHeaderDisabled;

    // Build Fern component nodes for custom header/footer components.
    // These ReactNode values are passed to the client-side CustomComponent,
    // which wraps them in function components so users can render with JSX syntax: <Fern.Search />
    const fernNodes: FernComponentNodes = {
        Logo: <React.Suspense fallback={null}>{logo}</React.Suspense>,
        Search: (
            <div className="flex w-full max-w-[640px] flex-row gap-2">
                <SearchV2Trigger
                    aria-label={t(lang).search.search}
                    className="fern-header-search-bar flex-1 overflow-hidden"
                    isSearchInSidebar={false}
                    placeholder={settings.searchText}
                    lang={lang}
                />
                {isAskAiEnabled && <SearchPanelTrigger aria-label={t(lang).search.askAI} lang={lang} />}
            </div>
        ),
        ProductSwitcher: <React.Suspense fallback={null}>{productSelect}</React.Suspense>,
        VersionSwitcher: <React.Suspense fallback={null}>{versionSelect}</React.Suspense>,
        LanguageSwitcher: <React.Suspense fallback={null}>{languageSelect}</React.Suspense>,
        NavbarLinks: <NavbarLinks loader={loader} />,
        LoginButton: (
            <React.Suspense fallback={null}>
                <LoginButton loader={loader} size="sm" className="ml-2" disabled={isLocalEnvironment} lang={lang} />
            </React.Suspense>
        ),
        ThemeSwitch: <ThemeSwitch iconOnly variant="ghost" className="ml-2" lang={lang} />,
        Tabs: <React.Suspense fallback={null}>{headertabs}</React.Suspense>,
        HamburgerMenu: <MobileMenuButton />
    };

    return (
        <ThemedDocs
            theme={theme}
            isSidebarFixed={
                !!colors.dark?.sidebarBackground || !!colors.light?.sidebarBackground || layout.isHeaderDisabled
            }
            lightSidebarClassName={colors.light?.sidebarBackgroundTheme === "dark" ? "dark" : undefined}
            darkSidebarClassName={colors.dark?.sidebarBackgroundTheme === "light" ? "light" : undefined}
            lightHeaderClassName={colors.light?.headerBackgroundTheme === "dark" ? "dark" : undefined}
            darkHeaderClassName={colors.dark?.headerBackgroundTheme === "light" ? "light" : undefined}
            isHeaderDisabled={layout.isHeaderDisabled}
            announcement={announcement}
            header={
                <HeaderContent
                    className="max-w-page-width mx-auto"
                    logo={<React.Suspense fallback={null}>{logo}</React.Suspense>}
                    versionSelect={
                        <React.Suspense fallback={null} key="version-select-1">
                            {versionSelect}
                        </React.Suspense>
                    }
                    productSelect={
                        <React.Suspense fallback={null} key="product-select-1">
                            {productSelect}
                        </React.Suspense>
                    }
                    languageSelect={
                        <React.Suspense fallback={null} key="language-select-1">
                            {languageSelect}
                        </React.Suspense>
                    }
                    showSearchBar={layout.searchbarPlacement === "HEADER"}
                    showSwitcher={layout.switcherPlacement !== "SIDEBAR"}
                    navbarLinks={<NavbarLinks loader={loader} />}
                    loginButton={
                        <React.Suspense fallback={null} key="login-button-header">
                            <LoginButton
                                loader={loader}
                                size="sm"
                                className="ml-2"
                                disabled={isLocalEnvironment}
                                lang={lang}
                            />
                        </React.Suspense>
                    }
                    headerDisabled={layout.isHeaderDisabled}
                    placeholder={settings.searchText}
                    lang={lang}
                />
            }
            productSelect={
                <React.Suspense fallback={null} key="product-select-2">
                    {productSelect}
                </React.Suspense>
            }
            tabs={headertabs}
            showSearchBarInTabs={layout.searchbarPlacement === "HEADER_TABS"}
            sidebar={
                <SidebarContainer
                    logo={
                        <React.Suspense fallback={null} key="logo-sidebar">
                            {logo}
                        </React.Suspense>
                    }
                    showSearchBar={layout.searchbarPlacement === "SIDEBAR"}
                    showSwitcher={layout.switcherPlacement === "SIDEBAR"}
                    showHeaderInSidebar={showHeaderInSidebar}
                    productSelect={
                        <React.Suspense fallback={null} key="product-select-3">
                            {productSelect}
                        </React.Suspense>
                    }
                    versionSelect={
                        <React.Suspense fallback={null} key="version-select-3">
                            {versionSelect}
                        </React.Suspense>
                    }
                    languageSelect={
                        <React.Suspense fallback={null} key="language-select-3">
                            {languageSelect}
                        </React.Suspense>
                    }
                    navbarLinks={
                        <React.Suspense fallback={null} key="navbar-links-sidebar">
                            <NavbarLinks loader={loader} />
                        </React.Suspense>
                    }
                    loginButton={
                        <React.Suspense fallback={null} key="login-button-sidebar">
                            <LoginButton
                                loader={loader}
                                className="my-6 flex w-full justify-between lg:hidden"
                                showIcon
                                lang={lang}
                            />
                        </React.Suspense>
                    }
                    searchBar={
                        <div
                            className={cn(
                                "flex flex-row w-full items-center gap-2",
                                !showHeaderInSidebar && "mt-3 lg:mt-2",
                                {
                                    "mt-3": showHeaderInSidebar && hasProductsOrVersions
                                }
                            )}
                        >
                            <SearchV2Trigger
                                aria-label={t(lang).search.search}
                                className={cn("w-full overflow-hidden")}
                                isSearchInSidebar={true}
                                placeholder={settings.searchText}
                                lang={lang}
                            />
                            {isAskAiEnabled && <SearchPanelTrigger isSearchInSidebar={true} lang={lang} />}
                        </div>
                    }
                    lang={lang}
                >
                    {sidebar}
                </SidebarContainer>
            }
            hasProductsOrVersions={hasProductsOrVersions}
            versionSelect={
                <React.Suspense fallback={null} key="version-select-2">
                    {versionSelect}
                </React.Suspense>
            }
            searchPlaceholder={settings.searchText ?? t(lang).search.search}
            lang={lang}
            hideFeedback={layout.hideFeedback}
            customHeaderUsesTabs={customHeaderUsesTabs}
            customHeader={
                compiledHeaderCode != null ? (
                    <CustomComponent code={compiledHeaderCode} componentType="header" fernNodes={fernNodes} />
                ) : undefined
            }
            customFooter={
                compiledFooterCode != null ? (
                    <CustomComponent code={compiledFooterCode} componentType="footer" fernNodes={fernNodes} />
                ) : undefined
            }
        >
            {children}
        </ThemedDocs>
    );
}
