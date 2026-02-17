"use client";

import { type DangerousTransmittableDocsLoaderData, PrefetchedDocsLoader } from "@fern-api/docs-loader/client";
import type * as FernNavigation from "@fern-api/fdr-sdk/navigation";

import type { SidebarRenderOptions } from "../SidebarRenderOptions";
import { SidebarRootNodeImpl } from "./SidebarRootNodeImpl";

export function SidebarClientRootNode({
    root,
    visibleNodeIds,
    loaderData,
    renderOptions,
    lang = "en"
}: {
    root: FernNavigation.SidebarRootNode | undefined;
    visibleNodeIds: FernNavigation.NodeId[] | undefined;
    loaderData: DangerousTransmittableDocsLoaderData;
    renderOptions?: SidebarRenderOptions;
    lang?: string;
}) {
    const forceClientRender = renderOptions?.forceClientRender ?? true;
    const wrapSectionNode = renderOptions?.wrapSectionNode;
    const wrapSectionContainer = renderOptions?.wrapSectionContainer;
    const wrapPageNode = renderOptions?.wrapPageNode;

    const loader = PrefetchedDocsLoader.fromSerializable(loaderData);
    const authState = loader.getAuthState();
    const edgeFlags = loader.getEdgeFlags();
    const files = loader.getFiles();

    return (
        <SidebarRootNodeImpl
            root={root}
            visibleNodeIds={visibleNodeIds}
            authState={authState}
            edgeFlags={edgeFlags}
            renderOptions={{
                forceClientRender,
                wrapSectionNode,
                wrapSectionContainer,
                wrapPageNode,
                files,
                showHidden: renderOptions?.showHidden
            }}
            lang={lang}
        />
    );
}
