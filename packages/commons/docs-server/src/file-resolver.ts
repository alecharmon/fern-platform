import type { FileData } from "@fern-api/docs-utils/types/file-data";
import { FernNavigation } from "@fern-api/fdr-sdk";

export function createFileResolver(files: Record<string, FileData>) {
    return (src: string | undefined) => {
        if (src == null) {
            return undefined;
        }

        const fileId = FernNavigation.FileId(src.startsWith("file:") ? src.slice(5) : src);
        const file = files[fileId];
        if (file == null) {
            // the file is not found, so we return the src as the image data

            if (fileId) {
                console.warn(`[file-resolver]: found unexpected fileId ${fileId}`);
            }

            return { src };
        }

        return file;
    };
}
