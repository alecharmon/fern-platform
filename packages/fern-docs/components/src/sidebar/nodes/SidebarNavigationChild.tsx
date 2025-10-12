import type * as FernNavigation from "@fern-api/fdr-sdk/navigation";
import type { ReactNode } from "react";
import { UnreachableCaseError } from "ts-essentials";

import { cn } from "../../cn";
import { processIcon } from "../../processIcon";
import { SidebarApiPackageChild } from "./SidebarApiPackageChild";
import { SidebarApiPackageNode } from "./SidebarApiPackageNode";
import { SidebarChangelogNode } from "./SidebarChangelogNode";
import { SidebarLinkNode } from "./SidebarLinkNode";
import { SidebarPageNode } from "./SidebarPageNode";
import { SidebarSectionNode } from "./SidebarSectionNode";

interface SidebarNavigationChildProps {
    node: FernNavigation.NavigationChild;
    depth: number;
    root?: boolean;
    forceClientRender?: boolean;
}

export function SidebarNavigationChild({
    node,
    depth,
    root,
    forceClientRender = false
}: SidebarNavigationChildProps): ReactNode {
    switch (node.type) {
        case "apiReference":
            return (
                <SidebarApiPackageNode node={node} depth={depth} icon={processIcon(node, undefined, forceClientRender)}>
                    {node.children.map((node: FernNavigation.ApiPackageChild) => (
                        <SidebarApiPackageChild key={node.id} node={node} depth={depth + 1} shallow={false} />
                    ))}
                </SidebarApiPackageNode>
            );
        case "section":
            return (
                <SidebarSectionNode
                    node={node}
                    icon={processIcon(node, undefined, forceClientRender)}
                    depth={depth}
                    className={cn({
                        "!text-body font-semibold": root
                    })}
                    forceClientRender={forceClientRender}
                >
                    {node.children.map((node: FernNavigation.NavigationChild) => (
                        <SidebarNavigationChild
                            key={node.id}
                            node={node}
                            depth={depth + 1}
                            forceClientRender={forceClientRender}
                        />
                    ))}
                </SidebarSectionNode>
            );
        case "page":
            return (
                <SidebarPageNode
                    node={node}
                    depth={depth}
                    icon={processIcon(node, undefined, forceClientRender)}
                    forceClientRender={forceClientRender}
                />
            );
        case "link":
            return <SidebarLinkNode node={node} depth={depth} icon={processIcon(node, undefined, forceClientRender)} />;
        case "changelog":
            return (
                <SidebarChangelogNode
                    node={node}
                    depth={depth}
                    icon={processIcon(node, undefined, forceClientRender)}
                />
            );
        default:
            throw new UnreachableCaseError(node);
    }
}
