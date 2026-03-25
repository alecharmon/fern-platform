"use client";

import * as Tabs from "@radix-ui/react-tabs";

import { useCurrentTabId } from "./state/navigation";

/**
 * Client component that wraps header tab triggers in a Radix Tabs.Root.
 * Accepts an initialTabId from the server so that the correct tab is marked
 * active during SSR (via defaultValue), eliminating the flicker that occurs
 * when the jotai atom is still undefined.
 *
 * When currentTabId (from the atom) is undefined, Radix uses defaultValue (uncontrolled mode).
 * Once the atom is set after hydration, Radix switches to controlled mode via value.
 */
export function HeaderTabsListRoot({
    children,
    initialTabId,
    centered
}: {
    children: React.ReactNode;
    initialTabId?: string;
    centered?: boolean;
}) {
    const currentTabId = useCurrentTabId();
    return (
        <Tabs.Root value={currentTabId} defaultValue={initialTabId} data-tabs-centered={centered || undefined}>
            {children}
        </Tabs.Root>
    );
}
