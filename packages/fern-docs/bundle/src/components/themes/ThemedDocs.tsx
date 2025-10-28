import dynamic from "next/dynamic";

import { I18N } from "@/constants";

const THEMES = {
    default: dynamic(() => import("./default/DefaultDocs"), { ssr: true }),
    cohere: dynamic(() => import("./cohere/CohereDocs"), { ssr: true })
};

export type FernTheme = keyof typeof THEMES;

export function ThemedDocs({
    theme = "default",
    announcement,
    header,
    versionSelect,
    productSelect,
    sidebar,
    children,
    tabs,
    hasProductsOrVersions = false,
    isSidebarFixed = false,
    isHeaderDisabled = false,
    showSearchBarInTabs = false,
    lightSidebarClassName,
    darkSidebarClassName,
    lightHeaderClassName,
    darkHeaderClassName,
    searchPlaceholder = I18N.search.search
}: {
    theme?: FernTheme;
    announcement?: React.ReactNode;
    header?: React.ReactNode;
    versionSelect?: React.ReactNode;
    productSelect?: React.ReactNode;
    sidebar?: React.ReactNode;
    children: React.ReactNode;
    tabs?: React.ReactNode;
    hasProductsOrVersions?: boolean;
    isSidebarFixed?: boolean;
    isHeaderDisabled?: boolean;
    showSearchBarInTabs?: boolean;
    lightSidebarClassName?: string;
    darkSidebarClassName?: string;
    lightHeaderClassName?: string;
    darkHeaderClassName?: string;
    searchPlaceholder?: string;
}) {
    const Docs = THEMES[theme];
    return (
        <Docs
            announcement={announcement}
            header={header}
            versionSelect={versionSelect}
            productSelect={productSelect}
            sidebar={sidebar}
            tabs={tabs}
            hasProductsOrVersions={hasProductsOrVersions}
            isSidebarFixed={isSidebarFixed}
            isHeaderDisabled={isHeaderDisabled}
            showSearchBarInTabs={showSearchBarInTabs}
            lightSidebarClassName={lightSidebarClassName}
            darkSidebarClassName={darkSidebarClassName}
            lightHeaderClassName={lightHeaderClassName}
            darkHeaderClassName={darkHeaderClassName}
            searchPlaceholder={searchPlaceholder}
        >
            {children}
        </Docs>
    );
}
