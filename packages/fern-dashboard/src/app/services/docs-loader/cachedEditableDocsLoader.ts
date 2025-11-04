import { createEditableDocsLoader } from "@fern-api/docs-loader";
import type { DocsLoader } from "@fern-api/docs-server/docs-loader";
import { cache } from "react";
import type { EncodedDocsUrl } from "@/utils/types";

/**
 * Cached version of createEditableDocsLoader to prevent duplicate loader creation
 * within the same request. Uses React's cache() to deduplicate based on parameters.
 */
export const getCachedEditableDocsLoader = cache(
    async (
        host: string,
        encodedDocsUrl: EncodedDocsUrl,
        fernToken: string,
        branchName?: string,
        forceRevalidate?: boolean
    ) => {
        return createEditableDocsLoader({
            host,
            encodedDocsUrl,
            fernToken,
            branchName,
            forceRevalidate
        });
    }
);
