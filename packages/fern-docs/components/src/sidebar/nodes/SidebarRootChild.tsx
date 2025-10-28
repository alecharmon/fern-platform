import type * as FernNavigation from "@fern-api/fdr-sdk/navigation";
import { UnreachableCaseError } from "ts-essentials";

import { processIcon } from "../../processIcon";
import type { SidebarRenderOptions } from "../SidebarRenderOptions";
import { SidebarGroupNode } from "./SidebarGroupNode";
import { SidebarRootApiPackageNode } from "./SidebarRootApiPackageNode";
import { SidebarRootSectionNode } from "./SidebarRootSectionNode";

export function SidebarRootChild({
    node,
    renderOptions
}: {
    node: FernNavigation.SidebarRootChild | FernNavigation.ApiPackageNode;
    renderOptions: SidebarRenderOptions;
}) {
    const forceClientRender = renderOptions.forceClientRender ?? false;

    switch (node.type) {
        case "sidebarGroup":
            return <SidebarGroupNode node={node} renderOptions={renderOptions} />;
        case "apiReference":
        case "apiPackage":
            return (
                <SidebarRootApiPackageNode
                    node={node}
                    icon={processIcon(node, undefined, forceClientRender)}
                    renderOptions={renderOptions}
                />
            );
        case "section":
            return (
                <SidebarRootSectionNode
                    node={node}
                    icon={processIcon(node, undefined, forceClientRender)}
                    renderOptions={renderOptions}
                />
            );
        case "varianted":
            throw new Error("unsupported type: varianted");
        default:
            throw new UnreachableCaseError(node);
    }
}
