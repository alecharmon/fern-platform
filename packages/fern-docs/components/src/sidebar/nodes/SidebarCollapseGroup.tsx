"use client";

import type * as FernNavigation from "@fern-api/fdr-sdk/navigation";
import type React from "react";
import type { ReactNode } from "react";

import { WithFeatureFlags } from "../../feature-flags/WithFeatureFlags";
import { useIsChildSelected, useIsExpanded, useToggleSidebarNode } from "../../state/navigation";
import { CollapsibleSidebarGroup } from "../CollapsibleSidebarGroup";
import { SidebarSlugLink } from "../SidebarLink";
import type { SidebarRenderOptions } from "../SidebarRenderOptions";

export function SidebarCollapseGroup({
    node,
    icon,
    depth,
    className,
    children,
    renderOptions
}: {
    node: FernNavigation.ApiReferenceNode | FernNavigation.ApiPackageNode | FernNavigation.SectionNode;
    icon: React.ReactNode;
    depth: number;
    className?: string;
    children: ReactNode;
    renderOptions: SidebarRenderOptions;
}): ReactNode {
    const handleToggleExpand = useToggleSidebarNode(node.id);
    const childSelected = useIsChildSelected(node.id);
    const expanded = useIsExpanded(node.id);
    const shallow = false;
    const showIndicator = childSelected && !expanded;

    const baseComponent = (
        <WithFeatureFlags featureFlags={node.featureFlags}>
            <CollapsibleSidebarGroup
                open={expanded}
                depth={depth}
                trigger={
                    <SidebarSlugLink
                        nodeId={node.id}
                        icon={icon}
                        className={className}
                        depth={Math.max(depth - 1, 0)}
                        title={node.title}
                        expanded={expanded}
                        onToggleExpand={node.children.length > 0 ? handleToggleExpand : undefined}
                        showIndicator={showIndicator}
                        hidden={node.hidden}
                        authed={node.authed}
                        slug={node.overviewPageId != null ? node.slug : undefined}
                        shallow={shallow}
                    />
                }
            >
                {children}
            </CollapsibleSidebarGroup>
        </WithFeatureFlags>
    );

    // If wrapSectionNode is provided (typically by fern-dashboard), apply it to node
    const wrapSectionNode = renderOptions.wrapSectionNode;

    return wrapSectionNode && node.type === "section" ? wrapSectionNode(node, baseComponent) : baseComponent;
}
