import type * as FernNavigation from "@fern-api/fdr-sdk/navigation";

import { processIcon } from "../../processIcon";
import type { SidebarRenderOptions } from "../SidebarRenderOptions";
import { SidebarGroupNode } from "./SidebarGroupNode";
import { SidebarLinkNode } from "./SidebarLinkNode";
import { SidebarPageNode } from "./SidebarPageNode";
import { SidebarRootApiPackageNode } from "./SidebarRootApiPackageNode";
import { SidebarRootSectionNode } from "./SidebarRootSectionNode";
import { SidebarVariantedNode } from "./SidebarVariantedNode";

export function SidebarRootChild({
    node,
    renderOptions,
    lang
}: {
    node:
        | FernNavigation.SidebarRootChild
        | FernNavigation.ApiPackageNode
        | FernNavigation.PageNode
        | FernNavigation.LinkNode;
    renderOptions: SidebarRenderOptions;
    lang: string;
}) {
    const forceClientRender = renderOptions.forceClientRender ?? false;
    const icon = processIcon({
        node,
        forceClientRender,
        files: renderOptions?.files,
        preResolvedIcons: renderOptions?.preResolvedIcons
    });

    switch (node.type) {
        case "sidebarGroup":
            return <SidebarGroupNode node={node} renderOptions={renderOptions} lang={lang} />;
        case "apiReference":
        case "apiPackage":
            return <SidebarRootApiPackageNode node={node} icon={icon} renderOptions={renderOptions} lang={lang} />;
        case "section":
            return <SidebarRootSectionNode node={node} icon={icon} renderOptions={renderOptions} lang={lang} />;
        case "varianted":
            return <SidebarVariantedNode node={node} depth={0} renderOptions={renderOptions} lang={lang} />;
        // Defensive: pages and links are not standard SidebarRootChild types, but can
        // end up here during drag-and-drop operations. Render them gracefully at depth 0
        // instead of crashing with an UnreachableCaseError.
        case "page":
            return <SidebarPageNode node={node} depth={0} icon={icon} renderOptions={renderOptions} />;
        case "link":
            return <SidebarLinkNode node={node} depth={0} icon={icon} />;
        default:
            console.warn(`[SidebarRootChild] Unexpected node type: ${(node as { type: string }).type}`);
            return null;
    }
}
