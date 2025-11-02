import type { FileData } from "@fern-api/docs-utils/types/file-data";
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
    /** The current variant ID from the URL (used for server-side variant selection) */
    currentVariantId?: FernNavigation.VariantId;
    /** Pre-resolved variant images (FileIds resolved to ReactNodes on the server) */
    variantImages?: Record<FernNavigation.VariantId, ReactNode>;
    /** Files data for resolving file: prefixed icons */
    files?: Record<string, FileData>;
}
