"use client";

import * as Tabs from "@radix-ui/react-tabs";

import { FernLayoutConfig } from "@fern-api/docs-utils/types/layout-config";

import { cn } from "../cn";
import { useCurrentTabId } from "../state/navigation";

export function SidebarTabsRootImpl({ children, layout }: { children: React.ReactNode; layout: FernLayoutConfig }) {
    const currentTabId = useCurrentTabId();

    return (
        <Tabs.Root
            value={currentTabId}
            className={cn({
                "lg:hidden": layout.tabsPlacement !== "SIDEBAR"
            })}
        >
            {children}
        </Tabs.Root>
    );
}
