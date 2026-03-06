import type { FileData } from "@fern-api/docs-utils/types/file-data";
import type { ReactNode } from "react";
import { FernImage } from "../FernImage";
import { FernSvgIcon } from "../FernSvgIcon";
import { sanitizeIconHtml } from "./sanitizeIconHtml";

export interface ProcessIconStringOptions {
    icon: string;
    files?: Record<string, FileData>;
    className?: string;
    renderFaIcon: (icon: string) => ReactNode;
    wrap?: (content: ReactNode) => ReactNode;
    renderUrlIcon?: (url: string, isSvg: boolean) => ReactNode;
}

function isUrlIcon(icon: string): boolean {
    return icon.startsWith("http://") || icon.startsWith("https://") || icon.startsWith("/");
}

function isSvgUrl(url: string): boolean {
    return url.toLowerCase().endsWith(".svg");
}

export const processIconString = ({
    icon,
    files,
    className = "size-5",
    renderFaIcon,
    wrap = (content) => content,
    renderUrlIcon
}: ProcessIconStringOptions): ReactNode | undefined => {
    if (icon.startsWith("file:")) {
        const fileId = icon.slice(5);
        const fileData = files?.[fileId];

        if (fileData) {
            if (fileData.src.toLowerCase().endsWith(".svg")) {
                return wrap(<FernSvgIcon src={fileData.src} alt={fileData.alt ?? ""} className={className} />);
            }

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

    if (renderUrlIcon && isUrlIcon(icon)) {
        return wrap(renderUrlIcon(icon, isSvgUrl(icon)));
    }

    if (icon.startsWith("<") && icon.endsWith(">")) {
        return wrap(<span className={className} dangerouslySetInnerHTML={{ __html: sanitizeIconHtml(icon) }} />);
    }

    return renderFaIcon(icon);
};
