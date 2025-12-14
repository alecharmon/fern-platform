import type { FileData } from "@fern-api/docs-utils/types/file-data";
import { FernImage } from "@fern-docs/components/FernImage";
import { FernSvgIcon } from "@fern-docs/components/FernSvgIcon";
import type { ReactNode } from "react";

export interface ProcessIconStringOptions {
    icon: string;
    files?: Record<string, FileData>;
    className?: string;
    renderFaIcon: (icon: string) => ReactNode;
    wrap?: (content: ReactNode) => ReactNode;
}

export const processIconString = ({
    icon,
    files,
    className = "size-5",
    renderFaIcon,
    wrap = (content) => content
}: ProcessIconStringOptions): ReactNode | undefined => {
    if (icon.startsWith("file:")) {
        const fileId = icon.slice(5);
        const fileData = files?.[fileId];

        if (fileData) {
            if (fileData.src.endsWith(".svg")) {
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

    if (icon.startsWith("<") && icon.endsWith(">")) {
        return wrap(<span className={className} dangerouslySetInnerHTML={{ __html: icon }} />);
    }

    return renderFaIcon(icon);
};
