import * as FernNavigation from "@fern-api/fdr-sdk/navigation";
import type { ReactNode } from "react";
import React from "react";

import { SidebarClientNavigationChildInjector } from "./SidebarClientNavigationChildInjector";
import { SidebarCollapseGroup } from "./SidebarCollapseGroup";
import { SidebarPageNode } from "./SidebarPageNode";

interface SidebarSectionNodeProps {
    node: FernNavigation.SectionNode;
    icon: React.ReactNode;
    depth: number;
    className?: string;
    children: ReactNode;
    forceClientRender?: boolean;
}

export function SidebarSectionNode({
    node,
    icon,
    className,
    depth,
    forceClientRender,
    children
}: SidebarSectionNodeProps): ReactNode {
    if (React.Children.count(children) === 0 && FernNavigation.hasMarkdown(node)) {
        return (
            <SidebarPageNode
                node={node}
                depth={depth}
                className={className}
                icon={icon}
                forceClientRender={forceClientRender}
            />
        );
    }

    if (React.Children.count(children) === 0) {
        return null;
    }

    return (
        <SidebarCollapseGroup node={node} icon={icon} depth={depth} className={className}>
            {/* Inject client nodes for this section */}
            <SidebarClientNavigationChildInjector
                parentNodeId={node.id}
                childDepth={depth + 1}
                forceClientRender={forceClientRender}
            />
            {children}
        </SidebarCollapseGroup>
    );
}
