import type * as FernNavigation from "@fern-api/fdr-sdk/navigation";
import type { ReactNode } from "react";
import { UnreachableCaseError } from "ts-essentials";

import { cn } from "../../cn";
import { processIcon } from "../../processIcon";
import type { SidebarRenderOptions } from "../SidebarRenderOptions";
import { SidebarApiPackageChild } from "./SidebarApiPackageChild";
import { SidebarApiPackageNode } from "./SidebarApiPackageNode";
import { SidebarChangelogNode } from "./SidebarChangelogNode";
import { SidebarLinkNode } from "./SidebarLinkNode";
import { SidebarPageNode } from "./SidebarPageNode";
import { SidebarSectionNode } from "./SidebarSectionNode";
import { SidebarVariantedNode } from "./SidebarVariantedNode";

interface SidebarNavigationChildProps {
    node: FernNavigation.NavigationChild;
    depth: number;
    root?: boolean;
    renderOptions: SidebarRenderOptions;
}

export function SidebarNavigationChild({ node, depth, root, renderOptions }: SidebarNavigationChildProps): ReactNode {
    const forceClientRender = renderOptions.forceClientRender ?? false;
    switch (node.type) {
        case "apiReference":
            return (
                <SidebarApiPackageNode
                    node={node}
                    depth={depth}
                    icon={processIcon(node, undefined, forceClientRender)}
                    renderOptions={renderOptions}
                >
                    {node.children.map((node: FernNavigation.ApiPackageChild) => (
                        <SidebarApiPackageChild
                            key={node.id}
                            node={node}
                            depth={depth + 1}
                            shallow={false}
                            renderOptions={renderOptions}
                        />
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
                    renderOptions={renderOptions}
                >
                    {node.children.map((node: FernNavigation.NavigationChild) => (
                        <SidebarNavigationChild
                            key={node.id}
                            node={node}
                            depth={depth + 1}
                            renderOptions={renderOptions}
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
                    renderOptions={renderOptions}
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
        case "varianted":
            return <SidebarVariantedNode node={node} depth={depth} renderOptions={renderOptions} />;
        default:
            throw new UnreachableCaseError(node);
    }
}
