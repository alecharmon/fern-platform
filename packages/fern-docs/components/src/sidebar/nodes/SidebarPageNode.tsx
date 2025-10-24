import type * as FernNavigation from "@fern-api/fdr-sdk/navigation";
import type { ReactNode } from "react";

import { WithFeatureFlags } from "../../feature-flags/WithFeatureFlags";
import { SidebarSlugLink } from "../SidebarLink";
import type { SidebarRenderOptions } from "../SidebarRenderOptions";

export interface SidebarPageNodeProps {
    node: FernNavigation.NavigationNodeWithMarkdown;
    icon: React.ReactNode;
    depth: number;
    className?: string;
    shallow?: boolean;
    renderOptions: SidebarRenderOptions;
}

export function SidebarPageNode({
    node,
    icon,
    depth,
    className,
    shallow,
    renderOptions
}: SidebarPageNodeProps): ReactNode {
    const baseComponent = (
        <WithFeatureFlags featureFlags={node.featureFlags}>
            <SidebarSlugLink
                icon={icon}
                nodeId={node.id}
                className={className}
                slug={node.slug}
                depth={Math.max(depth - 1, 0)}
                title={node.title}
                hidden={node.hidden}
                authed={node.authed}
                shallow={shallow}
            />
        </WithFeatureFlags>
    );

    // If wrapPageNode is provided (typically by fern-dashboard), apply it to node
    const wrapPageNode = renderOptions.wrapPageNode;

    return wrapPageNode ? wrapPageNode(node, baseComponent) : baseComponent;
}
