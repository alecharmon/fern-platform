/** Checks if file path points to a json file */
export function isJsonFilePath(filePath: string): boolean {
    return filePath.endsWith(".json");
}
