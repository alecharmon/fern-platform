import type { FileData } from "@fern-api/docs-utils/types/file-data";
import { FernNavigation } from "@fern-api/fdr-sdk";
import path from "path";

export class DashboardFileResolver {
    private filePathToFileIdMap: Record<string, FernNavigation.FileId> = {};
    private files: Record<string, FileData> = {};

    constructor(files: Record<string, FileData>) {
        this.filePathToFileIdMap = {};
        this.files = files;

        // Preload all files when the resolver is created
        for (const [fileId, file] of Object.entries(files)) {
            const path = this._extractPathAfterDate(file.src) || file.src;
            this.filePathToFileIdMap[path] = FernNavigation.FileId(fileId);
        }
    }

    getResolvedFileData(src: string | undefined, currentFilePath?: string) {
        if (src == null) {
            return undefined;
        }

        // Check cache first for immediate lookup
        if (this.files[src]) {
            return this.files[src];
        }

        // Fallback logic for edge cases
        let fileId: FernNavigation.FileId | undefined;

        // Resolve relative paths using the current file path
        let resolvedSrc = src.trim();
        if (currentFilePath && (src.startsWith("./") || src.startsWith("../"))) {
            // Get the directory of the current file
            const currentDir = path.dirname(currentFilePath);
            resolvedSrc = path.join(currentDir, src);
            // Normalize to remove any remaining .. or . segments
            resolvedSrc = path.normalize(resolvedSrc);
        }

        const trimmedSrc = resolvedSrc.replace(/^[./]+/g, "").replace(/\.\.\//g, "");

        // if the src is a file path, we use the file id from the map
        if (this.filePathToFileIdMap[src]) {
            fileId = this.filePathToFileIdMap[src];
        } else if (this.filePathToFileIdMap[resolvedSrc]) {
            fileId = this.filePathToFileIdMap[resolvedSrc];
        } else if (this.filePathToFileIdMap[trimmedSrc]) {
            fileId = this.filePathToFileIdMap[trimmedSrc];
        } else {
            // Check if any key in the map ends with the src we're looking for
            const matchingFile = Object.values(this.files).find(({ src: key }) => key.endsWith(trimmedSrc));
            if (matchingFile) {
                return matchingFile;
            }
        }

        if (!fileId) {
            // otherwise, we assume the src is a file id
            fileId = FernNavigation.FileId(src.startsWith("file:") ? src.slice(5) : src);
        }

        const file = this.files[fileId];

        if (file == null) {
            // the file is not found, so we return the src as the image data
            return { src };
        }

        return file;
    }

    /**
     * Extracts the path from the src, e.g.:
     * https://files.buildwithfern.com/sarahbawabe.docs.buildwithfern.com/2025-08-22T16:59:23.340Z/docs/assets/logo-light.svg
     * to docs/assets/logo-light.svg
     */
    private _extractPathAfterDate(url: string) {
        // Regular expression to match ISO date pattern
        const datePattern = /\/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z/;
        // Split by the date pattern and take everything after the first match
        const parts = url.split(datePattern);
        return parts.length > 1 ? parts[1] : "";
    }
}
