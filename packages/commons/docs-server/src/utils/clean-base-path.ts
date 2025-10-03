import { addLeadingSlash, removeTrailingSlash } from "@fern-api/docs-utils";
import { slugjoin } from "@fern-api/fdr-sdk/navigation";

export function cleanBasePath(basePath: string | undefined) {
    const basepath = removeTrailingSlash(addLeadingSlash(slugjoin(basePath)));
    if (basepath === "/") {
        return "";
    }
    return basepath;
}
