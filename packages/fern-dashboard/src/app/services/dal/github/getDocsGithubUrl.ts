import "server-only";

import { fernToken_admin } from "@fern-api/docs-server";
import { cache } from "react";
import { getDocsUrlMetadata } from "@/app/api/utils/getDocsUrlMetadata";
import type { DocsUrl } from "@/utils/types";

interface GetDocsGithubUrlSuccess {
    success: true;
    githubUrl: string;
}

interface GetDocsGithubUrlError {
    success: false;
    error:
        | { type: "MALFORMED_GITHUB_URL"; url: string }
        | { type: "DOMAIN_NOT_REGISTERED" }
        | { type: "REPO_NOT_CONNECTED" };
}

export type GetDocsGithubUrlResult = GetDocsGithubUrlSuccess | GetDocsGithubUrlError;

export const getDocsGithubUrl = cache(async (url: DocsUrl, token: string): Promise<GetDocsGithubUrlResult> => {
    const docsUrlMetadata = await getDocsUrlMetadata({
        url,
        token: fernToken_admin() ?? token
    });
    if (!docsUrlMetadata.ok) {
        // the docs url is user-supplied (parsed from the page url) so it's ok if it
        // doesn't exist
        if (docsUrlMetadata.error.error === "DomainNotRegisteredError") {
            // Don't cache this failure, so throw to skip cache
            return { success: false, error: { type: "DOMAIN_NOT_REGISTERED" } };
        }

        console.error("Failed to load docs URL metadata", JSON.stringify(docsUrlMetadata.error));
        return {
            success: false,
            error: { type: "MALFORMED_GITHUB_URL", url: decodeURIComponent(url) }
        };
    }

    if (docsUrlMetadata.body.gitUrl == null) {
        // Don't cache this failure, so throw to skip cache
        return { success: false, error: { type: "REPO_NOT_CONNECTED" } };
    }

    const [owner, repo] = docsUrlMetadata.body.gitUrl.split("/").slice(-2);
    if (owner == null || repo == null) {
        // Don't cache this failure, so throw to skip cache
        return {
            success: false,
            error: { type: "MALFORMED_GITHUB_URL", url: docsUrlMetadata.body.gitUrl }
        };
    }

    return { success: true, githubUrl: docsUrlMetadata.body.gitUrl };
});
