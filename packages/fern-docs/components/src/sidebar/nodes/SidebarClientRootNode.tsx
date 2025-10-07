"use client";

import { type DangerousTransmittableDocsLoaderData, PrefetchedDocsLoader } from "@fern-api/docs-loader/client";
import type * as FernNavigation from "@fern-api/fdr-sdk/navigation";

import { SidebarRootNodeImpl } from "./SidebarRootNodeImpl";

export function SidebarClientRootNode({
    root,
    visibleNodeIds,
    loaderData,
    forceClientRender
}: {
    root: FernNavigation.SidebarRootNode | undefined;
    visibleNodeIds: FernNavigation.NodeId[] | undefined;
    loaderData: DangerousTransmittableDocsLoaderData;
    forceClientRender?: boolean;
}) {
    const loader = PrefetchedDocsLoader.fromSerializable(loaderData);
    const authState = loader.getAuthState();
    const edgeFlags = loader.getEdgeFlags();

    return (
        <SidebarRootNodeImpl
            root={root}
            visibleNodeIds={visibleNodeIds}
            authState={authState}
            edgeFlags={edgeFlags}
            forceClientRender={forceClientRender}
        />
    );
}
