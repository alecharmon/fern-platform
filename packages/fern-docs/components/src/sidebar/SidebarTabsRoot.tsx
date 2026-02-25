import type { DocsLoader } from "@fern-api/docs-server/docs-loader";

import { SidebarTabsRootImpl } from "./SidebarTabsRootImpl";

export async function SidebarTabsRoot({
    loader,
    children,
    initialTabId
}: {
    loader: DocsLoader;
    children: React.ReactNode;
    initialTabId?: string;
}) {
    const layout = await loader.getLayout();

    return (
        <SidebarTabsRootImpl layout={layout} initialTabId={initialTabId}>
            {children}
        </SidebarTabsRootImpl>
    );
}
