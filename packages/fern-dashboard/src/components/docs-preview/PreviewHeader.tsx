"use client";

import { AbstractHeaderContent } from "@fern-docs/components/abstract/AbstractHeaderContent";
import { FERN_SEARCH_BUTTON_ID } from "@fern-docs/components/constants";
import { FernTooltip, FernTooltipProvider } from "@fern-docs/components/FernTooltip";
import { ThemeSwitch } from "@fern-docs/components/header/theme-switch";
import { DesktopSearchButton } from "@fern-docs/search-ui/components/desktop/desktop-search-button";

export function PreviewHeader({
    versionSelect,
    productSelect,
    navbarLinks,
    logo,
    showSearchBar,
    showSwitcher
}: {
    headertabs?: React.ReactNode;
    versionSelect?: React.ReactNode;
    productSelect?: React.ReactNode;
    navbarLinks?: React.ReactNode;
    logo?: React.ReactNode;
    showSearchBar?: boolean;
    showSwitcher?: boolean;
}) {
    return (
        <AbstractHeaderContent
            className="max-w-page-width mx-auto"
            logo={logo}
            versionSelect={versionSelect}
            productSelect={productSelect}
            navbarLinks={navbarLinks}
            showSearchBar={showSearchBar}
            showSwitcher={showSwitcher}
            themeSwitch={
                <FernTooltipProvider>
                    <FernTooltip content="Theme switch is disabled in editor" side="bottom" variant="dashboard">
                        <span className="pointer-events-auto ml-2 w-fit">
                            <ThemeSwitch iconOnly variant="ghost" disabled lang="en" />
                        </span>
                    </FernTooltip>
                </FernTooltipProvider>
            }
            searchBar={
                <DesktopSearchButton
                    lang="en"
                    id={FERN_SEARCH_BUTTON_ID}
                    className="fern-header-search-bar cursor-not-allowed overflow-hidden"
                />
            }
        />
    );
}
