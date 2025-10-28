"use client";

import { AbstractHeaderTabsRoot } from "@fern-docs/components/abstract/AbstractHeaderTabsRoot";

import { I18N } from "@/constants";
import { SearchV2Trigger, useIsAskAiEnabled } from "@/state/search";
import { SearchPanelTrigger } from "@/state/search-panel";

export function HeaderTabsRoot({
    children,
    showSearchBar,
    className,
    placeholder = I18N.search.search
}: {
    children: React.ReactNode;
    showSearchBar: boolean;
    className?: string;
    placeholder?: string;
}) {
    const isAskAiEnabled = useIsAskAiEnabled();
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
                            placeholder={placeholder}
                        />
                        {isAskAiEnabled && <SearchPanelTrigger aria-label="Ask AI" isSearchInSidebar={false} />}
                    </div>
                )
            }
        >
            {children}
        </AbstractHeaderTabsRoot>
    );
}
