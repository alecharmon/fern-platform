"use client";

import type * as FernNavigation from "@fern-api/fdr-sdk/navigation";
import type { ReactNode } from "react";

import { useMaybeNavigation } from "../../navigation";
import { compareByFractionalIndex } from "../../navigation/indexingUtils";
import { SidebarClientNavigationChild } from "./SidebarClientNavigationChild";

interface SidebarClientNavigationChildInjectorProps {
    childDepth: number;
    parentNodeId: FernNavigation.NodeId;
    forceClientRender?: boolean;
}

export function SidebarClientNavigationChildInjector({
    childDepth,
    parentNodeId,
    forceClientRender
}: SidebarClientNavigationChildInjectorProps): ReactNode {
    const navigation = useMaybeNavigation();

    if (!navigation?.pageRegistry) {
        return null;
    }

    // Get client pages that belong to this parent node
    const clientPages = Object.values(navigation.pageRegistry)
        .filter((entry) => {
            // Only include client-created pages
            if (entry.pageData.source !== "client") return false;

            // Only include pages that aren't marked for deletion
            if (entry.isMarkedForDeletion) return false;

            // Only include actual page nodes
            if (entry.pageData.foundNode.node.type !== "page") return false;

            // Check if this page belongs under the current parent node
            return entry.parentSectionId === parentNodeId;
        })
        .sort((a, b) => compareByFractionalIndex(a.index, b.index))
        .map((entry) => entry.pageData.foundNode.node as FernNavigation.PageNode);

    return (
        <>
            {clientPages.map((pageNode) => (
                <li key={pageNode.id}>
                    <SidebarClientNavigationChild
                        node={pageNode}
                        depth={childDepth}
                        forceClientRender={forceClientRender}
                    />
                </li>
            ))}
        </>
    );
}
