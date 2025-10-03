import { ReactNode } from "react";

import { NavigationNode } from "@fern-api/fdr-sdk/navigation";
import { hasMetadata } from "@fern-api/fdr-sdk/navigation";

import { NoZoom } from "./contexts/NoZoom";
import { FaIconServer } from "./fa-icon-server";

/**
 * TODO:
 * This is a duplicate of the processIcon function in the bundle. This uses the FaIconServer
 * component, which does not yet utilize next image caching. Until that is added, we are leaving
 * the original processIcon function in the bundle.
 */
export const processIcon = (node: NavigationNode, fallback?: string): ReactNode | undefined => {
    if (!hasMetadata(node) && node.type !== "link") {
        return undefined;
    }

    if (node.icon?.startsWith("<") && node.icon?.endsWith(">")) {
        return (
            <NoZoom>
                <span className="size-5" dangerouslySetInnerHTML={{ __html: node.icon }} />
            </NoZoom>
        );
    }

    if (node.icon) {
        return <FaIconServer icon={node.icon} />;
    }

    if (fallback) {
        return <FaIconServer icon={fallback} />;
    }

    return undefined;
};
