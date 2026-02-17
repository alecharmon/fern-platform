import type { FileData } from "@fern-api/docs-utils/types/file-data";
import type * as FernNavigation from "@fern-api/fdr-sdk/navigation";
import type { ReactNode } from "react";

/** Options for customizing the rendering behavior of the sidebar (typically used by fern-dashboard) */
export interface SidebarRenderOptions {
    /** Forces all sidebar nodes to render as client components */
    forceClientRender?: boolean;
    /** Wraps section heading with custom UI (e.g. context menu on hover) */
    wrapSectionNode?: (node: FernNavigation.SectionNode, component: ReactNode) => ReactNode;
    /** Wraps the entire section (heading + children) with a container (e.g. DnD drop zone) */
    wrapSectionContainer?: (node: FernNavigation.SectionNode, component: ReactNode) => ReactNode;
    /** Wraps page nodes with custom UI (e.g. context menu on hover) */
    wrapPageNode?: (node: FernNavigation.NavigationNodeWithMarkdown, component: ReactNode) => ReactNode;
    /** The current variant ID from the URL (used for server-side variant selection) */
    currentVariantId?: FernNavigation.VariantId;
    /** Pre-resolved variant images (FileIds resolved to ReactNodes on the server) */
    variantImages?: Record<FernNavigation.VariantId, ReactNode>;
    /** Pre-resolved icons (NodeIds mapped to ReactNodes, resolved server-side for better performance) */
    preResolvedIcons?: Record<FernNavigation.NodeId, ReactNode>;
    /** Files data for resolving file: prefixed icons */
    files?: Record<string, FileData>;
    /** If true, hidden nodes are kept visible in the sidebar (used by fern-dashboard editor) */
    showHidden?: boolean;
}
