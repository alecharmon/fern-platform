"use client";

import type { FernLayoutConfig } from "@fern-api/docs-utils/types/layout-config";
import * as Tabs from "@radix-ui/react-tabs";

import { cn } from "../cn";
import { useCurrentTabId } from "../state/navigation";

export function SidebarTabsRootImpl({
    children,
    layout,
    initialTabId
}: {
    children: React.ReactNode;
    layout: FernLayoutConfig;
    initialTabId?: string;
}) {
    const currentTabId = useCurrentTabId();

    return (
        <Tabs.Root
            value={currentTabId}
            defaultValue={initialTabId}
            className={cn({
                "lg:hidden": layout.tabsPlacement !== "SIDEBAR"
            })}
        >
            {children}
        </Tabs.Root>
    );
}
