import type * as FernNavigation from "@fern-api/fdr-sdk/navigation";
import type { ReactNode } from "react";

import { SidebarClientNavigationChildInjector } from "./SidebarClientNavigationChildInjector";
import { SidebarNavigationChild } from "./SidebarNavigationChild";

interface SidebarGroupNodeProps {
    node: FernNavigation.SidebarGroupNode;
    forceClientRender?: boolean;
}

export function SidebarGroupNode({ node, forceClientRender = false }: SidebarGroupNodeProps): ReactNode {
    return (
        <ul className="fern-sidebar-group">
            {/* Inject client nodes for this group */}
            <SidebarClientNavigationChildInjector
                parentNodeId={node.id}
                childDepth={1}
                forceClientRender={forceClientRender}
            />
            {node.children.map((child) => (
                <li key={child.id}>
                    <SidebarNavigationChild node={child} depth={1} root forceClientRender={forceClientRender} />
                </li>
            ))}
        </ul>
    );
}
