import * as FernNavigation from "@fern-api/fdr-sdk/navigation";
import type { ReactNode } from "react";
import React from "react";

import type { SidebarRenderOptions } from "../SidebarRenderOptions";
import { SidebarCollapseGroup } from "./SidebarCollapseGroup";
import { SidebarPageNode } from "./SidebarPageNode";

interface SidebarSectionNodeProps {
    node: FernNavigation.SectionNode;
    icon: React.ReactNode;
    depth: number;
    className?: string;
    children: ReactNode;
    renderOptions: SidebarRenderOptions;
}

export function SidebarSectionNode({
    node,
    icon,
    className,
    depth,
    children,
    renderOptions
}: SidebarSectionNodeProps): ReactNode {
    // If wrapSectionNode is provided (typically by fern-dashboard), apply it to node
    const wrapSectionNode = renderOptions.wrapSectionNode;

    if (React.Children.count(children) === 0 && FernNavigation.hasMarkdown(node)) {
        const pageNodeComponent = (
            <SidebarPageNode
                node={node}
                depth={depth}
                className={className}
                icon={icon}
                renderOptions={renderOptions}
            />
        );

        return wrapSectionNode ? wrapSectionNode(node, pageNodeComponent) : pageNodeComponent;
    }

    if (React.Children.count(children) === 0) {
        return null;
    }

    return (
        <SidebarCollapseGroup node={node} icon={icon} depth={depth} className={className} renderOptions={renderOptions}>
            {children}
        </SidebarCollapseGroup>
    );
}
