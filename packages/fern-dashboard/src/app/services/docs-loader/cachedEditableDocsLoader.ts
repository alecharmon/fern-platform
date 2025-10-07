import { createEditableDocsLoader } from "@fern-api/docs-loader";
import { cache } from "react";

import type { GitHubUrl } from "@/app/services/github/types";

import { GitHubLoader } from "../github/github-loader";

/**
 * Cached version of createEditableDocsLoader to prevent duplicate loader creation
 * within the same request. Uses React's cache() to deduplicate based on parameters.
 */
export const getCachedEditableDocsLoader = cache(
    async ({
        host,
        encodedDocsUrl,
        fernToken,
        githubUrl,
        branchName,
        forceRevalidate
    }: {
        host: string;
        encodedDocsUrl: string;
        fernToken?: string;
        githubUrl?: GitHubUrl;
        branchName?: string;
        forceRevalidate?: boolean;
    }) => {
        return createEditableDocsLoader({
            host,
            encodedDocsUrl,
            fernToken,
            gitLoader: githubUrl ? new GitHubLoader(githubUrl) : undefined,
            branchName,
            forceRevalidate
        });
    }
);
