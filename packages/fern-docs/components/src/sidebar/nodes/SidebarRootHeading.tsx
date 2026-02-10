import * as FernNavigation from "@fern-api/fdr-sdk/navigation";
import type { ReactNode } from "react";

import { cn } from "../../cn";
import type { SidebarRenderOptions } from "../SidebarRenderOptions";
import { SidebarPageNode } from "./SidebarPageNode";

interface SidebarRootHeadingProps {
    node: FernNavigation.NavigationNodeSection;
    icon: React.ReactNode;
    className: string | undefined;
    shallow?: boolean;
    renderOptions: SidebarRenderOptions;
}

export function SidebarRootHeading({
    node,
    icon,
    className,
    shallow,
    renderOptions
}: SidebarRootHeadingProps): ReactNode {
    // If wrapSectionNode is provided (typically by fern-dashboard), apply it to nodes
    const wrapSectionNode = renderOptions.wrapSectionNode;

    if (FernNavigation.hasMarkdown(node)) {
        const pageNodeComponent = (
            <SidebarPageNode
                node={node}
                depth={0}
                className={cn(className, "!text-body font-semibold")}
                shallow={shallow}
                icon={icon}
                renderOptions={renderOptions}
            />
        );

        return wrapSectionNode && node.type === "section"
            ? wrapSectionNode(node, pageNodeComponent)
            : pageNodeComponent;
    }

    const headingComponent = (
        <div className={cn("fern-sidebar-heading fern-sidebar-level-0", className)}>
            {icon}
            <span className="fern-sidebar-heading-content">{node.title}</span>
        </div>
    );

    return wrapSectionNode && node.type === "section" ? wrapSectionNode(node, headingComponent) : headingComponent;
}
