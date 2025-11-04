import type { FileData } from "@fern-api/docs-utils/types/file-data";
import type { NavigationNode } from "@fern-api/fdr-sdk/navigation";
import { hasMetadata } from "@fern-api/fdr-sdk/navigation";
import type { ReactNode } from "react";

import { NoZoom } from "./contexts/NoZoom";
import { FernImage } from "./FernImage";
import { FernSvgIcon } from "./FernSvgIcon";
import { FaIconServer } from "./fa-icon-server";

export interface ProcessIconOptions {
    node: NavigationNode;
    fallback?: string;
    forceClientRender?: boolean;
    files?: Record<string, FileData>;
}

/**
 * TODO:
 * This is a duplicate of the processIcon function in the bundle. This uses the FaIconServer
 * component, which does not yet utilize next image caching. Until that is added, we are leaving
 * the original processIcon function in the bundle.
 */
export const processIcon = ({
    node,
    fallback,
    forceClientRender,
    files
}: ProcessIconOptions): ReactNode | undefined => {
    if (!hasMetadata(node) && node.type !== "link") {
        return undefined;
    }

    if (node.icon?.startsWith("file:")) {
        const fileId = node.icon.slice(5); // Remove "file:" prefix
        const fileData = files?.[fileId];

        if (fileData) {
            if (fileData.src.endsWith(".svg")) {
                return (
                    <NoZoom>
                        <FernSvgIcon src={fileData.src} alt={fileData.alt ?? ""} className="fern-file-icon size-5" />
                    </NoZoom>
                );
            }

            return (
                <NoZoom>
                    <FernImage
                        src={fileData.src}
                        alt={fileData.alt ?? ""}
                        className="fern-file-icon size-5"
                        blurDataURL={fileData.blurDataURL}
                    />
                </NoZoom>
            );
        } else {
            return undefined;
        }
    }

    if (node.icon?.startsWith("<") && node.icon?.endsWith(">")) {
        return (
            <NoZoom>
                <span className="size-5" dangerouslySetInnerHTML={{ __html: node.icon }} />
            </NoZoom>
        );
    }

    if (node.icon) {
        return <FaIconServer icon={node.icon} forceClientRender={forceClientRender} />;
    }

    if (fallback) {
        return <FaIconServer icon={fallback} forceClientRender={forceClientRender} />;
    }

    return undefined;
};
