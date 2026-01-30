import { AbstractHeaderTabsRoot } from "@fern-docs/components/abstract/AbstractHeaderTabsRoot";
import { FERN_SEARCH_BUTTON_ID } from "@fern-docs/components/constants";
import { NavbarLinks } from "@fern-docs/components/header/NavbarLinks";
import { Providers } from "@fern-docs/components/providers/providers";
import { SidebarContainer } from "@fern-docs/components/sidebar/SidebarContainer";
import { RootNodeProvider } from "@fern-docs/components/state/navigation";
import {
    getAllSidebarRootNodes,
    getSidebarRootNodeIdToChildToParentsMap
} from "@fern-docs/components/state/navigation-server";
import { FernThemeProvider } from "@fern-docs/components/theme";
import AbstractDefaultDocs from "@fern-docs/components/theming/AbstractDefaultDocs";
import { GlobalStyles } from "@fern-docs/components/theming/global-styles";
import { DesktopSearchButton } from "@fern-docs/search-ui/components/desktop/desktop-search-button";
import type React from "react";
import { Suspense } from "react";
import type { Auth0OrgName } from "@/app/services/auth0/types";
import { getCachedEditableDocsLoader } from "@/app/services/docs-loader/cachedEditableDocsLoader";
import { PreviewHeader } from "@/components/docs-preview/PreviewHeader";
import { EditorLinkInterceptor } from "@/components/editor/EditorLinkInterceptor";
import { ResizablePanelsWrapper } from "@/components/editor/ResizablePanelsWrapper";
import { EditorRoutingProvider } from "@/providers/EditorRoutingContext";
import { FileResolverProvider } from "@/providers/FileResolverContext";
import { getHostFromHeaders } from "@/utils/getHostFromHeaders";
import type { EncodedDocsUrl } from "@/utils/types";

import "./index.css";
import { assertAuthAndFetchGithubUrl } from "@/app/services/dal/github/assertAuthAndFetchGithubUrl";
import { parseDocsUrlParam } from "@/utils/parseDocsUrlParam";

export default async function VisualEditorPreviewLayout({
    params,
    children,
    headertabs,
    versionSelect,
    productSelect,
    sidebar,
    logo,
    devPanel
}: Readonly<{
    params: Promise<{
        orgName: Auth0OrgName;
        docsUrl: EncodedDocsUrl;
        branch: string;
    }>;
    children: React.JSX.Element;
    headertabs: React.ReactNode;
    versionSelect: React.ReactNode;
    productSelect: React.ReactNode;
    sidebar: React.ReactNode;
    logo: React.ReactNode;
    devPanel: React.ReactNode;
}>) {
    const { orgName, docsUrl, branch } = await params;

    const { session } = await assertAuthAndFetchGithubUrl(orgName, parseDocsUrlParam({ docsUrl }));
    const host = await getHostFromHeaders();

    // Use cached loader to prevent duplicate creation across parallel routes
    const loader = await getCachedEditableDocsLoader(host, docsUrl, session.accessToken, branch);

    const [colors, layout, fonts, config, root, unsafe_fullRoot, files, { basePath }, theme] = await Promise.all([
        loader.getColors(),
        loader.getLayout(),
        loader.getFonts(),
        loader.getConfig(),
        loader.getRoot(),
        loader.unsafe_getFullRoot(),
        loader.getFiles(),
        loader.getMetadata(),
        loader.getTheme()
    ]);

    const hasProductsOrVersions = root.child.type === "productgroup" || root.child.type === "versioned";

    const showHeaderInSidebar = layout.isHeaderDisabled;

    const showSearchBarInHeaderTabs = layout.searchbarPlacement === "HEADER_TABS";
    const sidebarRootNodes = getAllSidebarRootNodes(unsafe_fullRoot);
    const sidebarRootNodesToChildToParentsMap = getSidebarRootNodeIdToChildToParentsMap(sidebarRootNodes);

    return (
        <div className="m-2 h-[calc(100vh-var(--header-toolbar-height))]">
            <FileResolverProvider files={files}>
                <Providers skipProgressProvider={true}>
                    <FernThemeProvider
                        hasLight={Boolean(colors.light)}
                        hasDark={Boolean(colors.dark)}
                        lightThemeColor={colors.light?.themeColor}
                        darkThemeColor={colors.dark?.themeColor}
                    >
                        <GlobalStyles
                            domain={docsUrl}
                            layout={layout}
                            fonts={fonts}
                            light={colors.light}
                            dark={colors.dark}
                            inlineCss={config.css?.inline}
                            inlineCssScopeSelector="#preview-container, [data-testid=product-dropdown-content], [data-testid=version-dropdown-content]"
                            scopeSelector="#preview-container"
                            lightSelector=".light #preview-container"
                            darkSelector=".dark #preview-container"
                            theme={theme}
                        />
                        <RootNodeProvider sidebarRootNodesToChildToParentsMap={sidebarRootNodesToChildToParentsMap}>
                            <ResizablePanelsWrapper
                                left={
                                    <div className="border-1 flex h-full flex-col overflow-hidden rounded-2xl border-gray-500 border-b-0 rounded-b-none shadow-lg">
                                        {/* BOUNDARY NOTE: All items within the #preview-container will be themed with domain-specific styles. */}
                                        <EditorRoutingProvider
                                            value={{
                                                orgName,
                                                docsUrl,
                                                branch,
                                                basePath
                                            }}
                                        >
                                            <div id="preview-container">
                                                <EditorLinkInterceptor />
                                                {/* Wrapper divs mirror document structure (html > body) for CSS scoping */}
                                                <div data-fern-html="">
                                                    <div
                                                        data-fern-body=""
                                                        data-body-theme={theme?.body}
                                                        data-product-switcher-theme={theme?.productSwitcher}
                                                    >
                                                        <AbstractDefaultDocs
                                                            header={
                                                                <PreviewHeader
                                                                    navbarLinks={<NavbarLinks loader={loader} />}
                                                                    headertabs={headertabs}
                                                                    versionSelect={versionSelect}
                                                                    productSelect={productSelect}
                                                                    logo={logo}
                                                                    showSearchBar={
                                                                        layout.searchbarPlacement === "HEADER"
                                                                    }
                                                                />
                                                            }
                                                            lightSidebarClassName={
                                                                colors.light?.sidebarBackgroundTheme === "dark"
                                                                    ? "dark"
                                                                    : undefined
                                                            }
                                                            darkSidebarClassName={
                                                                colors.dark?.sidebarBackgroundTheme === "light"
                                                                    ? "light"
                                                                    : undefined
                                                            }
                                                            lightHeaderClassName={
                                                                colors.light?.headerBackgroundTheme === "dark"
                                                                    ? "dark"
                                                                    : undefined
                                                            }
                                                            darkHeaderClassName={
                                                                colors.dark?.headerBackgroundTheme === "light"
                                                                    ? "light"
                                                                    : undefined
                                                            }
                                                            isHeaderDisabled={layout.isHeaderDisabled}
                                                            versionSelect={versionSelect}
                                                            productSelect={productSelect}
                                                            isSidebarFixed={
                                                                !!colors.dark?.sidebarBackground ||
                                                                !!colors.light?.sidebarBackground ||
                                                                layout.isHeaderDisabled
                                                            }
                                                            sidebar={
                                                                <SidebarContainer
                                                                    key="sidebar-container"
                                                                    logo={<Suspense fallback={null}>{logo}</Suspense>}
                                                                    showSearchBar={
                                                                        layout.searchbarPlacement === "SIDEBAR"
                                                                    }
                                                                    showSwitcher={
                                                                        layout.switcherPlacement === "SIDEBAR"
                                                                    }
                                                                    showHeaderInSidebar={showHeaderInSidebar}
                                                                    productSelect={
                                                                        <Suspense
                                                                            fallback={null}
                                                                            key="product-select-3"
                                                                        >
                                                                            {productSelect}
                                                                        </Suspense>
                                                                    }
                                                                    versionSelect={
                                                                        <Suspense
                                                                            fallback={null}
                                                                            key="version-select-3"
                                                                        >
                                                                            {versionSelect}
                                                                        </Suspense>
                                                                    }
                                                                    navbarLinks={
                                                                        <Suspense fallback={null}>
                                                                            <NavbarLinks loader={loader} />
                                                                        </Suspense>
                                                                    }
                                                                    loginButton={
                                                                        <Suspense fallback={null}>
                                                                            {/* <LoginButton
                                                                                loader={loader}
                                                                                className="my-6 flex w-full justify-between lg:hidden"
                                                                                showIcon
                                                                                /> */}
                                                                        </Suspense>
                                                                    }
                                                                    searchBar={<DesktopSearchButton lang="en" />}
                                                                    lang="en"
                                                                >
                                                                    {sidebar}
                                                                </SidebarContainer>
                                                            }
                                                            headerTabs={
                                                                <AbstractHeaderTabsRoot
                                                                    searchBar={
                                                                        showSearchBarInHeaderTabs && (
                                                                            <DesktopSearchButton
                                                                                id={FERN_SEARCH_BUTTON_ID}
                                                                                className="fern-header-search-bar cursor-not-allowed overflow-hidden"
                                                                                lang="en"
                                                                            />
                                                                        )
                                                                    }
                                                                >
                                                                    {headertabs}
                                                                </AbstractHeaderTabsRoot>
                                                            }
                                                            hasProductsOrVersions={hasProductsOrVersions}
                                                        >
                                                            <div className="flex h-[var(--preview-container-height)] flex-1 justify-center overflow-y-scroll items-start">
                                                                {children}
                                                            </div>
                                                        </AbstractDefaultDocs>
                                                    </div>
                                                </div>
                                            </div>
                                        </EditorRoutingProvider>
                                    </div>
                                }
                                right={devPanel}
                            />
                        </RootNodeProvider>
                    </FernThemeProvider>
                </Providers>
            </FileResolverProvider>
        </div>
    );
}
