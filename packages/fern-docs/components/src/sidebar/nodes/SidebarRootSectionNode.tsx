import type { FileData } from "@fern-api/docs-utils/types/file-data";
import * as FernNavigation from "@fern-api/fdr-sdk/navigation";
import type { ReactNode } from "react";
import { WithFeatureFlags } from "../../feature-flags/WithFeatureFlags";
import type { SidebarRenderOptions } from "../SidebarRenderOptions";
import { SidebarNavigationChild } from "./SidebarNavigationChild";
import { SidebarPageNode } from "./SidebarPageNode";
import { SidebarRootHeading } from "./SidebarRootHeading";

interface SidebarRootSectionNodeProps {
    node: FernNavigation.SectionNode;
    icon: React.ReactNode;
    className?: string;
    renderOptions: SidebarRenderOptions;
    files?: Record<string, FileData>;
    lang: string;
}

export function SidebarRootSectionNode({
    node,
    icon,
    className,
    renderOptions,
    files,
    lang
}: SidebarRootSectionNodeProps): ReactNode {
    const wrapSectionContainer = renderOptions.wrapSectionContainer;

    // If the node has no children, it is a page node.
    if (node.children.length === 0 && FernNavigation.hasMarkdown(node)) {
        return (
            <SidebarPageNode node={node} depth={0} className={className} icon={icon} renderOptions={renderOptions} />
        );
    }

    if (node.children.length === 0) {
        return null;
    }

    // wrapSectionNode is applied inside SidebarRootHeading (wraps the heading).
    // wrapSectionContainer wraps the entire section (heading + children) with
    // a drop zone for drag-and-drop.
    const sectionContent = (
        <WithFeatureFlags featureFlags={node.featureFlags}>
            <SidebarRootHeading node={node} className={className} icon={icon} renderOptions={renderOptions} />

            <ul className="fern-sidebar-group fern-sidebar-group-level-1">
                {node.children.map((child) => (
                    <li key={child.id}>
                        <SidebarNavigationChild
                            node={child}
                            depth={1}
                            renderOptions={renderOptions}
                            files={files}
                            lang={lang}
                        />
                    </li>
                ))}
            </ul>
        </WithFeatureFlags>
    );

    return wrapSectionContainer ? wrapSectionContainer(node, sectionContent) : sectionContent;
}
