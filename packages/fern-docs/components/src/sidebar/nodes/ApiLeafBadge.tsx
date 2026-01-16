"use client";

import type { FernNavigation } from "@fern-api/fdr-sdk";

import { ApiMethodBadge } from "../../badges";
import { cn } from "../../cn";
import { useIsSelectedSidebarNode } from "../../state/navigation";

export function ApiLeafBadge({ node, className }: { node: FernNavigation.NavigationNodeApiLeaf; className?: string }) {
    const selected = useIsSelectedSidebarNode(node.id);
    if (node.type === "webSocket") {
        return (
            <ApiMethodBadge method="GET" size="sm" variant={selected ? "solid" : "subtle"} className={className}>
                WSS
            </ApiMethodBadge>
        );
    } else if (node.type === "graphql") {
        // GraphQL operations display their operation type as a badge
        const label = node.operationType === "QUERY" ? "Q" : node.operationType === "MUTATION" ? "M" : "S";
        return (
            <ApiMethodBadge method="GET" size="sm" variant={selected ? "solid" : "subtle"} className={className}>
                {label}
            </ApiMethodBadge>
        );
    } else {
        if (node.type === "endpoint" && node.isResponseStream) {
            return (
                <ApiMethodBadge
                    method={node.method}
                    size="sm"
                    variant={selected ? "solid" : "subtle"}
                    className={cn(className, {
                        "tracking-tighter": node.isResponseStream
                    })}
                >
                    STREAM
                </ApiMethodBadge>
            );
        }

        return (
            <ApiMethodBadge
                method={node.method}
                size="sm"
                variant={selected ? "solid" : "subtle"}
                className={className}
            />
        );
    }
}
