import type { FileData } from "@fern-api/docs-utils/types/file-data";
import type { ReactNode } from "react";

import { NoZoom } from "../contexts/NoZoom";
import { FernImage } from "../FernImage";
import { FaIconServer } from "../fa-icon-server";
import { sanitizeIconHtml } from "../util/sanitizeIconHtml";

export interface ProcessNavbarIconOptions {
    icon?: string;
    files?: Record<string, FileData>;
}

/**
 * Process navbar link icons supporting multiple formats:
 * - file: prefix for custom uploaded images
 * - HTML SVG strings (wrapped in < >)
 * - FontAwesome icon names
 */
export const processNavbarIcon = ({ icon, files }: ProcessNavbarIconOptions): ReactNode | undefined => {
    if (!icon) {
        return undefined;
    }

    // Handle file-based icons (e.g., "file:icon-id")
    if (icon.startsWith("file:")) {
        const fileId = icon.slice(5); // Remove "file:" prefix
        const fileData = files?.[fileId];

        if (fileData) {
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
        }
    }

    // Handle inline SVG strings
    if (icon.startsWith("<") && icon.endsWith(">")) {
        return (
            <NoZoom>
                <span className="size-5" dangerouslySetInnerHTML={{ __html: sanitizeIconHtml(icon) }} />
            </NoZoom>
        );
    }

    // Handle FontAwesome icons
    return <FaIconServer icon={icon} />;
};
