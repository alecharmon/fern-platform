import type { FileData } from "@fern-api/docs-utils/types/file-data";
import type { NavigationNode } from "@fern-api/fdr-sdk/navigation";
import { hasMetadata } from "@fern-api/fdr-sdk/navigation";
import { NoZoom } from "@fern-docs/components/contexts/NoZoom";
import { FernImage } from "@fern-docs/components/FernImage";
import type { ReactNode } from "react";
import { FaIconServer } from "../fa-icon-server";

export interface ProcessIconOptions {
    node: NavigationNode;
    fallback?: string;
    files?: Record<string, FileData>;
}

export const processIcon = ({ node, fallback, files }: ProcessIconOptions): ReactNode | undefined => {
    if (!hasMetadata(node) && node.type !== "link") {
        return undefined;
    }

    if (node.icon?.startsWith("file:")) {
        const fileId = node.icon.slice(5); // Remove "file:" prefix
        const fileData = files?.[fileId];

        if (fileData) {
            return (
                <NoZoom>
                    <FernImage
                        src={fileData.src}
                        alt={fileData.alt ?? ""}
                        className="fern-file-icon size-5"
                        {...(fileData.blurDataURL && {
                            blurDataURL: fileData.blurDataURL,
                            placeholder: "blur" as const
                        })}
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
        return <FaIconServer icon={node.icon} />;
    }

    if (fallback) {
        return <FaIconServer icon={fallback} />;
    }

    return undefined;
};
