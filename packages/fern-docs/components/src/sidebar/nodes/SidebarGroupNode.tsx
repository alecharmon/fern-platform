import type { FileData } from "@fern-api/docs-utils/types/file-data";
import type * as FernNavigation from "@fern-api/fdr-sdk/navigation";
import type { ReactNode } from "react";
import type { SidebarRenderOptions } from "../SidebarRenderOptions";
import { SidebarNavigationChild } from "./SidebarNavigationChild";

interface SidebarGroupNodeProps {
    node: FernNavigation.SidebarGroupNode;
    renderOptions: SidebarRenderOptions;
    files?: Record<string, FileData>;
    lang: string;
}

export function SidebarGroupNode({ node, renderOptions, lang }: SidebarGroupNodeProps): ReactNode {
    return (
        <ul className="fern-sidebar-group">
            {node.children.map((child) => (
                <li key={child.id}>
                    <SidebarNavigationChild node={child} depth={1} root renderOptions={renderOptions} lang={lang} />
                </li>
            ))}
        </ul>
    );
}
