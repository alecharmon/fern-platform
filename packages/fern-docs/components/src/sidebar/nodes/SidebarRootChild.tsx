import type * as FernNavigation from "@fern-api/fdr-sdk/navigation";
import { UnreachableCaseError } from "ts-essentials";

import { processIcon } from "../../processIcon";
import type { SidebarRenderOptions } from "../SidebarRenderOptions";
import { SidebarGroupNode } from "./SidebarGroupNode";
import { SidebarRootApiPackageNode } from "./SidebarRootApiPackageNode";
import { SidebarRootSectionNode } from "./SidebarRootSectionNode";
import { SidebarVariantedNode } from "./SidebarVariantedNode";

export function SidebarRootChild({
    node,
    renderOptions,
    lang
}: {
    node: FernNavigation.SidebarRootChild | FernNavigation.ApiPackageNode;
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
        default:
            throw new UnreachableCaseError(node);
    }
}
