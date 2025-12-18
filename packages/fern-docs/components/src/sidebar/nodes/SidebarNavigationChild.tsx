import type { FileData } from "@fern-api/docs-utils/types/file-data";
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
    files?: Record<string, FileData>;
    lang: string;
}

export function SidebarNavigationChild({
    node,
    depth,
    root,
    renderOptions,
    lang
}: SidebarNavigationChildProps): ReactNode {
    const forceClientRender = renderOptions.forceClientRender ?? false;
    const icon = processIcon({
        node,
        forceClientRender,
        files: renderOptions?.files,
        preResolvedIcons: renderOptions?.preResolvedIcons
    });
    switch (node.type) {
        case "apiReference":
            return (
                <SidebarApiPackageNode node={node} depth={depth} icon={icon} renderOptions={renderOptions} lang={lang}>
                    {node.children.map((node: FernNavigation.ApiPackageChild) => (
                        <SidebarApiPackageChild
                            key={node.id}
                            node={node}
                            depth={depth + 1}
                            shallow={false}
                            renderOptions={renderOptions}
                            lang={lang}
                        />
                    ))}
                </SidebarApiPackageNode>
            );
        case "section":
            return (
                <SidebarSectionNode
                    node={node}
                    icon={icon}
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
                            lang={lang}
                        />
                    ))}
                </SidebarSectionNode>
            );
        case "page":
            return <SidebarPageNode node={node} depth={depth} icon={icon} renderOptions={renderOptions} />;
        case "link":
            return <SidebarLinkNode node={node} depth={depth} icon={icon} />;
        case "changelog":
            return <SidebarChangelogNode node={node} depth={depth} icon={icon} lang={lang} />;
        case "varianted":
            return <SidebarVariantedNode node={node} depth={depth} renderOptions={renderOptions} lang={lang} />;
        default:
            throw new UnreachableCaseError(node);
    }
}
