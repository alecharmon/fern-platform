"use client";

import { type DangerousTransmittableDocsLoaderData, PrefetchedDocsLoader } from "@fern-api/docs-loader/client";

import { SidebarTabsRootImpl } from "./SidebarTabsRootImpl";

export function SidebarClientTabsRoot({
    children,
    loaderData,
    initialTabId
}: {
    children: React.ReactNode;
    loaderData: DangerousTransmittableDocsLoaderData;
    initialTabId?: string;
}) {
    const loader = PrefetchedDocsLoader.fromSerializable(loaderData);
    const layout = loader.getLayout();

    return (
        <SidebarTabsRootImpl layout={layout} initialTabId={initialTabId}>
            {children}
        </SidebarTabsRootImpl>
    );
}
