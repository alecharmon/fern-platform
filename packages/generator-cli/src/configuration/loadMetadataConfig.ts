import type { AbsoluteFilePath } from "@fern-api/fs-utils";
import { readFile } from "fs/promises";

export async function loadMetadataConfig({
    absolutePathToConfig
}: {
    absolutePathToConfig: AbsoluteFilePath;
}): Promise<unknown> {
    const rawContents = await readFile(absolutePathToConfig, "utf8");
    return JSON.parse(rawContents);
}
