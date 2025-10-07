import type * as FernNavigation from "@fern-api/fdr-sdk/navigation";
import { UnreachableCaseError } from "ts-essentials";

import { processIcon } from "../../processIcon";
import { SidebarGroupNode } from "./SidebarGroupNode";
import { SidebarRootApiPackageNode } from "./SidebarRootApiPackageNode";
import { SidebarRootSectionNode } from "./SidebarRootSectionNode";

export function SidebarRootChild({
    node,
    forceClientRender
}: {
    node: FernNavigation.SidebarRootChild | FernNavigation.ApiPackageNode;
    forceClientRender?: boolean;
}) {
    switch (node.type) {
        case "sidebarGroup":
            return <SidebarGroupNode node={node} forceClientRender={forceClientRender} />;
        case "apiReference":
        case "apiPackage":
            return (
                <SidebarRootApiPackageNode
                    node={node}
                    icon={processIcon(node, undefined, forceClientRender)}
                    forceClientRender={forceClientRender}
                />
            );
        case "section":
            return (
                <SidebarRootSectionNode
                    node={node}
                    icon={processIcon(node, undefined, forceClientRender)}
                    forceClientRender={forceClientRender}
                />
            );
        default:
            throw new UnreachableCaseError(node);
    }
}
