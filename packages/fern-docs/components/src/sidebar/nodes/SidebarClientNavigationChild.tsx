"use client";

import type * as FernNavigation from "@fern-api/fdr-sdk/navigation";
import type { ReactNode } from "react";
import { UnreachableCaseError } from "ts-essentials";

import { processIcon } from "../../processIcon";
import { SidebarPageNode } from "./SidebarPageNode";

interface SidebarClientNavigationChildProps {
    node: FernNavigation.NavigationChild;
    depth: number;
    root?: boolean;
    forceClientRender?: boolean;
}

export function SidebarClientNavigationChild({
    node,
    depth,
    forceClientRender
}: SidebarClientNavigationChildProps): ReactNode {
    switch (node.type) {
        case "page":
            return (
                <SidebarPageNode
                    className="cursor-pointer"
                    node={node}
                    depth={depth}
                    icon={processIcon(node, undefined, forceClientRender)}
                    forceClientRender={forceClientRender}
                />
            );
        case "apiReference":
        case "section":
        case "link":
        case "changelog":
            throw new Error("Client navigation children cannot be of type " + node.type);
        default:
            throw new UnreachableCaseError(node);
    }
}
