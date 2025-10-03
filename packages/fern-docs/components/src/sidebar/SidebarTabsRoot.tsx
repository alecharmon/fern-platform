import { DocsLoader } from "@fern-api/docs-server/docs-loader";

import { SidebarTabsRootImpl } from "./SidebarTabsRootImpl";

export async function SidebarTabsRoot({ loader, children }: { loader: DocsLoader; children: React.ReactNode }) {
    const layout = await loader.getLayout();

    return <SidebarTabsRootImpl layout={layout}>{children}</SidebarTabsRootImpl>;
}
