"use client";

import type React from "react";

import { useDomain } from "@fern-docs/components/state/domain";
import AbstractDefaultDocs from "@fern-docs/components/theming/AbstractDefaultDocs";

import { HeaderTabsRoot } from "@/components/header/HeaderTabsRoot";
import { SearchPanel } from "@/components/search-panel";
import { useIsAskAiEnabled } from "@/state/search";
import { useIsSearchPanelOpen, useIsSearchPanelResizing } from "@/state/search-panel";

export default function DefaultDocs({
    header,
    versionSelect,
    productSelect,
    sidebar,
    children,
    announcement,
    tabs,
    hasProductsOrVersions = false,
    isSidebarFixed = false,
    isHeaderDisabled = false,
    showSearchBarInTabs = false,
    lightHeaderClassName,
    darkHeaderClassName,
    lightSidebarClassName,
    darkSidebarClassName
}: {
    header: React.ReactNode;
    versionSelect?: React.ReactNode;
    productSelect?: React.ReactNode;
    sidebar: React.ReactNode;
    children: React.ReactNode;
    announcement?: React.ReactNode;
    tabs?: React.ReactNode;
    hasProductsOrVersions?: boolean;
    isSidebarFixed?: boolean;
    isHeaderDisabled?: boolean;
    showSearchBarInTabs?: boolean;
    lightHeaderClassName?: string;
    darkHeaderClassName?: string;
    lightSidebarClassName?: string;
    darkSidebarClassName?: string;
}) {
    const domain = useDomain();
    const isSidePanelOpen = useIsSearchPanelOpen();
    const isResizing = useIsSearchPanelResizing();
    const isAskAiEnabled = useIsAskAiEnabled();
    return (
        <>
            <AbstractDefaultDocs
                versionSelect={versionSelect}
                productSelect={productSelect}
                sidebar={sidebar}
                announcement={announcement}
                header={header}
                hasProductsOrVersions={hasProductsOrVersions}
                isSidebarFixed={isSidebarFixed}
                isHeaderDisabled={isHeaderDisabled}
                isSidePanelOpen={isSidePanelOpen}
                isSidePanelResizing={isResizing}
                headerTabs={<HeaderTabsRoot showSearchBar={showSearchBarInTabs}>{tabs}</HeaderTabsRoot>}
                lightHeaderClassName={lightHeaderClassName}
                darkHeaderClassName={darkHeaderClassName}
                lightSidebarClassName={lightSidebarClassName}
                darkSidebarClassName={darkSidebarClassName}
            >
                {children}
            </AbstractDefaultDocs>
            {isAskAiEnabled && <SearchPanel domain={domain} />}
        </>
    );
}
