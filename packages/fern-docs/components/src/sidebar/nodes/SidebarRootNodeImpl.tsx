import type React from "react";

import type { AuthState } from "@fern-api/docs-server/auth/getAuthState";
import { withPrunedNavigation } from "@fern-api/docs-server/withPrunedNavigation";
import type { EdgeFlags } from "@fern-api/docs-utils";
import type * as FernNavigation from "@fern-api/fdr-sdk/navigation";

import { SidebarRootChild } from "./SidebarRootChild";

/**
 * Called by both SidebarRootNode and SidebarClientRootNode to render the sidebar
 */
export function SidebarRootNodeImpl({
    root,
    visibleNodeIds,
    authState,
    edgeFlags
}: {
    root: FernNavigation.SidebarRootNode | undefined;
    visibleNodeIds: FernNavigation.NodeId[] | undefined;
    authState: AuthState;
    edgeFlags: EdgeFlags;
}) {
    const node = withPrunedNavigation(root, {
        visibleNodeIds: visibleNodeIds,
        authed: authState.authed,
        // when true, all unauthed pages are visible, but rendered with a LOCK button
        // so they're not actually "pruned" from the sidebar
        // TODO: move this out of a feature flag and into the navigation node metadata
        discoverable: edgeFlags.isAuthenticatedPagesDiscoverable ? (true as const) : undefined
    });

    const children =
        node?.children.flatMap((child): React.ComponentProps<typeof SidebarRootChild>["node"][] => {
            if (child.type !== "apiReference" || !child.hideTitle) {
                return [child];
            }

            const groups: (FernNavigation.ApiReferenceNode | FernNavigation.ApiPackageNode)[] = [];

            // if the ApiReference is set to `hideTitle=true`, we need to re-group the children
            // such that the root node appears to contain a collection of api references rather than a single one
            [...child.children, ...(child.changelog != null ? [child.changelog] : [])].forEach((innerChild) => {
                if (innerChild.type === "apiPackage") {
                    groups.push(innerChild);
                } else {
                    let lastGroup = groups[groups.length - 1];
                    if (lastGroup?.type !== "apiReference") {
                        lastGroup = {
                            ...child,
                            // Generate a unique ID for the group
                            id: `${child.id}-${groups.length}` as FernNavigation.NodeId,
                            children: [],
                            changelog: undefined
                        };
                        groups.push(lastGroup);
                    }

                    if (innerChild.type === "changelog") {
                        lastGroup.changelog = innerChild;
                    } else {
                        lastGroup.children.push(innerChild);
                    }
                }
            });

            return groups;
        }) ?? [];

    return (
        <>
            {children.length > 0 && (
                <ul className="fern-sidebar-group space-y-6 lg:px-1">
                    {children.map((child) => (
                        <li key={child.id}>
                            <SidebarRootChild node={child} />
                        </li>
                    ))}
                </ul>
            )}
        </>
    );
}
