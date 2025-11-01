import visitDiscriminatedUnion from "@fern-api/ui-core-utils/visitDiscriminatedUnion";

import type { FernNavigation } from "../../..";
import { hasMetadata } from "./NavigationNodeWithMetadata";

export function followRedirect(
    nodeToFollow: FernNavigation.V1.NavigationNode | undefined
): FernNavigation.V1.Slug | undefined {
    if (nodeToFollow == null) {
        return undefined;
    }
    return visitDiscriminatedUnion(nodeToFollow)._visit<FernNavigation.V1.Slug | undefined>({
        link: () => undefined,

        // leaf nodes
        page: (node) => node.slug,
        changelog: (node) => node.slug,
        changelogYear: (node) => node.slug,
        changelogMonth: (node) => node.slug,
        changelogEntry: (node) => node.slug,
        endpoint: (node) => node.slug,
        webSocket: (node) => node.slug,
        webhook: (node) => node.slug,
        grpc: (node) => node.slug,
        landingPage: (node) => node.slug,

        // nodes with overview
        apiPackage: (node) => (node.overviewPageId != null ? node.slug : followRedirects(node.children)),
        section: (node) => (node.overviewPageId != null ? node.slug : followRedirects(node.children)),
        apiReference: (node) => (node.overviewPageId != null ? node.slug : followRedirects(node.children)),

        product: (node) => followRedirect(node.child),
        productLink: () => undefined,
        productgroup: (node) => followRedirect(node.landingPage ?? node.children.filter((node) => !node.hidden)[0]),
        // version is a special case where it should only consider it's first child (the first version)
        versioned: (node) => followRedirect(node.children.filter((node) => !node.hidden)[0]),
        unversioned: (node) => followRedirect(node.landingPage ?? node.child),
        varianted: (node) => followRedirect(node.children.filter((node) => !node.hidden)[0]),
        variant: (node) => followRedirects(node.children),
        tabbed: (node) => followRedirects(node.children),
        sidebarRoot: (node) => followRedirects(node.children),
        endpointPair: (node) => followRedirect(node.nonStream),
        root: (node) => followRedirect(node.child),
        version: (node) => followRedirect(node.child),
        tab: (node) => followRedirect(node.child),
        sidebarGroup: (node) => followRedirects(node.children)
    });
}

export function followRedirects(nodes: FernNavigation.V1.NavigationNode[]): FernNavigation.V1.Slug | undefined {
    for (const node of nodes) {
        // skip hidden nodes
        if (hasMetadata(node) && node.hidden) {
            continue;
        }
        const redirect = followRedirect(node);
        if (redirect != null) {
            return redirect;
        }
    }
    return;
}
