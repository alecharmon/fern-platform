import type * as FernNavigation from "@fern-api/fdr-sdk/navigation";
import type { ReactNode } from "react";

/** Options for customizing the rendering behavior of the sidebar (typically used by fern-dashboard) */
export interface SidebarRenderOptions {
    /** Forces all sidebar nodes to render as client components */
    forceClientRender?: boolean;
    /** Wraps section nodes with custom UI (e.g. menu button on hover) */
    wrapSectionNode?: (node: FernNavigation.SectionNode, component: ReactNode) => ReactNode;
    /** Wraps page nodes with custom UI (e.g. delete button on hover) */
    wrapPageNode?: (node: FernNavigation.NavigationNodeWithMarkdown, component: ReactNode) => ReactNode;
}
