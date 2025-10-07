import type * as FernNavigation from "@fern-api/fdr-sdk/navigation";
import type { ReactNode } from "react";

import { WithFeatureFlags } from "../../feature-flags/WithFeatureFlags";
import { SidebarSlugLink } from "../SidebarLink";
import { withDeletablePageNode } from "./withDeletablePageNode";

export interface SidebarPageNodeProps {
    node: FernNavigation.NavigationNodeWithMarkdown;
    icon: React.ReactNode;
    depth: number;
    className?: string;
    shallow?: boolean;
    forceClientRender?: boolean;
}

export function SidebarPageNode({
    node,
    icon,
    depth,
    className,
    shallow,
    forceClientRender = false
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

    // Only wrap with deletable page node when explicitly in client render mode
    if (forceClientRender) {
        const DeletablePageNode = withDeletablePageNode(() => baseComponent);
        return <DeletablePageNode node={node} icon={icon} depth={depth} className={className} shallow={shallow} />;
    }

    return baseComponent;
}
