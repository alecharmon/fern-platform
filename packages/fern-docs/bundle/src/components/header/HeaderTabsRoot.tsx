"use client";

import { AbstractHeaderTabsRoot } from "@fern-docs/components/abstract/AbstractHeaderTabsRoot";

import { t } from "@fern-docs/i18n";
import { SearchV2Trigger, useIsAskAiEnabled } from "@/state/search";
import { SearchPanelTrigger } from "@/state/search-panel";

export function HeaderTabsRoot({
    children,
    showSearchBar,
    className,
    placeholder,
    lang
}: {
    children: React.ReactNode;
    showSearchBar: boolean;
    className?: string;
    placeholder?: string;
    lang: string;
}) {
    const isAskAiEnabled = useIsAskAiEnabled();
    const searchPlaceholder = placeholder ?? t(lang).search.search;
    return (
        <AbstractHeaderTabsRoot
            className={className}
            searchBar={
                showSearchBar && (
                    <div className="flex max-w-[640px] flex-row gap-2">
                        <SearchV2Trigger
                            aria-label="Search"
                            className="max-w-sidebar-width overflow-hidden"
                            isSearchInSidebar={false}
                            placeholder={searchPlaceholder}
                            lang={lang}
                        />
                        {isAskAiEnabled && (
                            <SearchPanelTrigger aria-label="Ask AI" isSearchInSidebar={false} lang={lang} />
                        )}
                    </div>
                )
            }
        >
            {children}
        </AbstractHeaderTabsRoot>
    );
}
