"use client";

import * as Tabs from "@radix-ui/react-tabs";

import { cn } from "../cn";
import { useCurrentTabId } from "../state/navigation";

export function AbstractHeaderTabsRoot({
    children,
    className,
    searchBar
}: {
    children: React.ReactNode;
    className?: string;
    searchBar?: React.ReactNode;
}) {
    const currentTabId = useCurrentTabId();
    return (
        <Tabs.Root value={currentTabId} className={cn("fern-header-tabs", className)}>
            {children}
            {searchBar}
        </Tabs.Root>
    );
}
