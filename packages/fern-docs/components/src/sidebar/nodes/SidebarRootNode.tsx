import type { DocsLoader } from "@fern-api/docs-server/docs-loader";
import type * as FernNavigation from "@fern-api/fdr-sdk/navigation";

import { SidebarRootNodeImpl } from "./SidebarRootNodeImpl";

export async function SidebarRootNode({
    root,
    visibleNodeIds,
    loader
}: {
    root: FernNavigation.SidebarRootNode | undefined;
    visibleNodeIds: FernNavigation.NodeId[] | undefined;
    loader: DocsLoader;
}) {
    const authState = await loader.getAuthState();
    const edgeFlags = await loader.getEdgeFlags();

    return (
        <SidebarRootNodeImpl root={root} visibleNodeIds={visibleNodeIds} authState={authState} edgeFlags={edgeFlags} />
    );
}
