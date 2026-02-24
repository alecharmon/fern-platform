"use client";

import type * as FernNavigation from "@fern-api/fdr-sdk/navigation";

import { ExternalLink } from "lucide-react";
import type { ReactNode } from "react";
import React from "react";

import { useLocationHref } from "../../hooks/useLocationHref";
import { SidebarLink } from "../SidebarLink";

interface SidebarLinkNodeProps {
    node: FernNavigation.LinkNode;
    icon: React.ReactNode;
    depth: number;
    className?: string;
}

export function SidebarLinkNode({ node, icon, depth, className }: SidebarLinkNodeProps): ReactNode {
    const locationHref = useLocationHref();
    const selected = locationHref === String(new URL(node.url, locationHref).href);

    const isExternal = React.useMemo(() => {
        try {
            if (!locationHref) {
                return false;
            }
            const linkUrl = new URL(node.url, locationHref);
            const currentUrl = new URL(locationHref);
            return linkUrl.host !== currentUrl.host;
        } catch {
            return false;
        }
    }, [node.url, locationHref]);

    return (
        <SidebarLink
            icon={icon}
            nodeId={node.id}
            className={className}
            depth={Math.max(depth - 1, 0)}
            title={node.title}
            rightElement={isExternal ? <ExternalLink /> : undefined}
            href={node.url}
            target={node.target}
            selected={selected}
        />
    );
}
