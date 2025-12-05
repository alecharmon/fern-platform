import "server-only";

import { fernToken_admin } from "@fern-api/docs-server";
import { cache } from "react";
import { getDocsUrlMetadata } from "@/app/api/utils/getDocsUrlMetadata";
import type { DocsUrl } from "@/utils/types";
import { parseGitUrl } from "../../git-common/url-utils";

interface GetDocsGitUrlSuccess {
    success: true;
    gitUrl: string;
}

interface GetDocsGitUrlError {
    success: false;
    error:
        | { type: "MALFORMED_GIT_URL"; url: string }
        | { type: "DOMAIN_NOT_REGISTERED" }
        | { type: "REPO_NOT_CONNECTED" };
}

export type GetDocsGitUrlResult = GetDocsGitUrlSuccess | GetDocsGitUrlError;

export const getDocsGitUrl = cache(async (url: DocsUrl, token: string): Promise<GetDocsGitUrlResult> => {
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
            error: { type: "MALFORMED_GIT_URL", url: decodeURIComponent(url) }
        };
    }

    if (docsUrlMetadata.body.gitUrl == null) {
        // Don't cache this failure, so throw to skip cache
        return { success: false, error: { type: "REPO_NOT_CONNECTED" } };
    }

    // Use the parseGitUrl utility to properly extract owner and repo
    const parsed = parseGitUrl(docsUrlMetadata.body.gitUrl);

    if (parsed.owner == null || parsed.repo == null || parsed.provider === "unknown") {
        // Don't cache this failure, so throw to skip cache
        return {
            success: false,
            error: { type: "MALFORMED_GIT_URL", url: docsUrlMetadata.body.gitUrl }
        };
    }

    return { success: true, gitUrl: docsUrlMetadata.body.gitUrl };
});
