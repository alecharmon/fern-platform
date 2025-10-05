"use client";

import { type DangerousTransmittableDocsLoaderData, PrefetchedDocsLoader } from "@fern-api/docs-loader/client";

import { SidebarTabsRootImpl } from "./SidebarTabsRootImpl";

export function SidebarClientTabsRoot({
    children,
    loaderData
}: {
    children: React.ReactNode;
    loaderData: DangerousTransmittableDocsLoaderData;
}) {
    const loader = PrefetchedDocsLoader.fromSerializable(loaderData);
    const layout = loader.getLayout();

    return <SidebarTabsRootImpl layout={layout}>{children}</SidebarTabsRootImpl>;
}
