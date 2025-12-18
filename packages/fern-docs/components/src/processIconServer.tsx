import type { FileData } from "@fern-api/docs-utils/types/file-data";
import type { NavigationNode } from "@fern-api/fdr-sdk/navigation";
import { hasMetadata } from "@fern-api/fdr-sdk/navigation";
import type { ReactNode } from "react";

import { NoZoom } from "./contexts/NoZoom";
import { FaIconServer } from "./fa-icon-server";
import { processIconStringServer } from "./util/processIconStringServer";

export interface ProcessIconServerOptions {
    node: NavigationNode;
    fallback?: string;
    files?: Record<string, FileData>;
}

export async function processIconServer({
    node,
    fallback,
    files
}: ProcessIconServerOptions): Promise<ReactNode | undefined> {
    if (!hasMetadata(node) && node.type !== "link" && node.type !== "productLink") {
        return undefined;
    }

    if (node.icon) {
        return await processIconStringServer({
            icon: node.icon,
            files,
            className: "fern-file-icon size-5",
            renderFaIcon: (icon) => <FaIconServer icon={icon} forceClientRender={false} />,
            wrap: (content) => <NoZoom>{content}</NoZoom>
        });
    }

    if (fallback) {
        return <FaIconServer icon={fallback} forceClientRender={false} />;
    }

    return undefined;
}
