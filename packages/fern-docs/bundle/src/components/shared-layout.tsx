import "server-only";

import type { DocsLoader } from "@fern-api/docs-server/docs-loader";
import { isLocal } from "@fern-api/docs-server/isLocal";
import { isSelfHosted } from "@fern-api/docs-server/isSelfHosted";
import { cn } from "@fern-docs/components/cn";
import { NavbarLinks } from "@fern-docs/components/header/NavbarLinks";
import { SidebarContainer } from "@fern-docs/components/sidebar/SidebarContainer";
import React from "react";

import { Announcement } from "@/components/header/Announcement";
import { HeaderContent } from "@/components/header/HeaderContent";
import { ThemedDocs } from "@/components/themes/ThemedDocs";
import { i18n } from "@/constants";
import { setMdxSerializer } from "@/context/MdxSerializerContext";
import { MdxServerComponent } from "@/mdx/components/server-component";
import { createCachedMdxSerializer } from "@/server/mdx-serializer";
import { SearchV2Trigger } from "@/state/search";
import { SearchPanelTrigger } from "@/state/search-panel";
import { LoginButton } from "./login-button";

export default async function SharedLayout({
    children,
    headertabs,
    sidebar,
    versionSelect,
    productSelect,
    loader,
    logo
}: {
    children: React.ReactNode;
    headertabs: React.ReactNode;
    sidebar?: React.ReactNode;
    versionSelect: React.ReactNode;
    productSelect: React.ReactNode;
    loader: DocsLoader & {
        clearKvCache: () => Promise<void>;
        isAskAiEnabledForDocs: () => Promise<boolean>;
    };
    logo: React.ReactNode;
}) {
    const isLocalEnvironment = isLocal() || isSelfHosted();

    const [config, settings, edgeFlags, colors, layout, root, isAskAiEnabled] = await Promise.all([
        loader.getConfig(),
        loader.getSettings(),
        loader.getEdgeFlags(),
        loader.getColors(),
        loader.getLayout(),
        loader.getRoot(),
        loader.isAskAiEnabledForDocs()
    ]);
    const theme = edgeFlags.isCohereTheme ? "cohere" : "default";
    const announcementText = config.announcement?.text;

    const serialize = createCachedMdxSerializer(loader, {
        useNextMdx: edgeFlags.isNextMdxRef
    });
    setMdxSerializer(serialize);

    const hasProductsOrVersions = root.child.type === "productgroup" || root.child.type === "versioned";
    const showHeaderInSidebar = layout.isHeaderDisabled;

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
            announcement={
                announcementText && (
                    <Announcement announcement={announcementText}>
                        <React.Suspense fallback={announcementText}>
                            <MdxServerComponent serialize={serialize} mdx={announcementText} />
                        </React.Suspense>
                    </Announcement>
                )
            }
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
                    showSearchBar={layout.searchbarPlacement === "HEADER"}
                    navbarLinks={<NavbarLinks loader={loader} />}
                    loginButton={
                        <React.Suspense fallback={null}>
                            <LoginButton loader={loader} size="sm" className="ml-2" disabled={isLocalEnvironment} />
                        </React.Suspense>
                    }
                    forceHeader={edgeFlags.isCohereTheme}
                    headerDisabled={layout.isHeaderDisabled}
                    placeholder={settings.searchText}
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
                    logo={<React.Suspense fallback={null}>{logo}</React.Suspense>}
                    showSearchBar={layout.searchbarPlacement === "SIDEBAR"}
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
                    navbarLinks={
                        <React.Suspense fallback={null}>
                            <NavbarLinks loader={loader} />
                        </React.Suspense>
                    }
                    loginButton={
                        <React.Suspense fallback={null}>
                            <LoginButton
                                loader={loader}
                                className="my-6 flex w-full justify-between lg:hidden"
                                showIcon
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
                                aria-label={i18n.search.search}
                                className={cn("w-full overflow-hidden")}
                                isSearchInSidebar={true}
                                placeholder={settings.searchText}
                            />
                            {isAskAiEnabled && <SearchPanelTrigger isSearchInSidebar={true} />}
                        </div>
                    }
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
            searchPlaceholder={settings.searchText}
        >
            {children}
        </ThemedDocs>
    );
}
