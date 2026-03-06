import type { FileData } from "@fern-api/docs-utils/types/file-data";
import type { ReactNode } from "react";
import { FernImage } from "../FernImage";
import { FernSvgIconServer } from "../FernSvgIconServer";
import { sanitizeIconHtml } from "./sanitizeIconHtml";

export interface ProcessIconStringServerOptions {
    icon: string;
    files?: Record<string, FileData>;
    className?: string;
    renderFaIcon: (icon: string) => ReactNode | Promise<ReactNode>;
    wrap?: (content: ReactNode) => ReactNode;
}

export async function processIconStringServer({
    icon,
    files,
    className = "size-5",
    renderFaIcon,
    wrap = (content) => content
}: ProcessIconStringServerOptions): Promise<ReactNode | undefined> {
    if (icon.startsWith("file:")) {
        const fileId = icon.slice(5);
        const fileData = files?.[fileId];

        if (fileData) {
            if (fileData.src.endsWith(".svg")) {
                // Use server-side SVG rendering
                return wrap(await FernSvgIconServer({ src: fileData.src, alt: fileData.alt ?? "", className }));
            }

            // Use FernImage for non-SVG files (can be server-rendered)
            return wrap(
                <FernImage
                    src={fileData.src}
                    alt={fileData.alt ?? ""}
                    className={className}
                    {...(fileData.blurDataURL && {
                        blurDataURL: fileData.blurDataURL,
                        placeholder: "blur" as const
                    })}
                />
            );
        }
        return undefined;
    }

    if (icon.startsWith("<") && icon.endsWith(">")) {
        // Inline HTML/SVG can be server-rendered
        return wrap(<span className={className} dangerouslySetInnerHTML={{ __html: sanitizeIconHtml(icon) }} />);
    }

    // Font Awesome icons - await if async
    const faIcon = renderFaIcon(icon);
    return faIcon instanceof Promise ? await faIcon : faIcon;
}
