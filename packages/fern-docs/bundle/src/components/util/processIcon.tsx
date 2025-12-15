import type { FileData } from "@fern-api/docs-utils/types/file-data";
import type { NavigationNode } from "@fern-api/fdr-sdk/navigation";
import { hasMetadata } from "@fern-api/fdr-sdk/navigation";
import { NoZoom } from "@fern-docs/components/contexts/NoZoom";
import { FaIconServer } from "@fern-docs/components/fa-icon-server";
import type { ReactNode } from "react";
import { processIconString } from "./processIconString";

export interface ProcessIconOptions {
    node: NavigationNode;
    fallback?: string;
    files?: Record<string, FileData>;
}

export const processIcon = ({ node, fallback, files }: ProcessIconOptions): ReactNode | undefined => {
    if (!hasMetadata(node) && node.type !== "link") {
        return undefined;
    }

    if (node.icon) {
        return processIconString({
            icon: node.icon,
            files,
            className: "fern-file-icon size-5",
            renderFaIcon: (icon) => <FaIconServer icon={icon} />,
            wrap: (content) => <NoZoom>{content}</NoZoom>
        });
    }

    if (fallback) {
        return <FaIconServer icon={fallback} />;
    }

    return undefined;
};
