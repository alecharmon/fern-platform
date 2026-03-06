import { fernToken_admin } from "@fern-api/docs-server";
import { cacheLife, cacheTag } from "next/cache";

import { getDocsUrlMetadata } from "@/app/api/utils/getDocsUrlMetadata";
import { parseGitUrl } from "@/app/services/git-common/url-utils";
import type { DocsUrl } from "@/utils/types";

interface CachedGetDocsGitUrlSuccess {
    success: true;
    gitUrl: string;
}

interface CachedGetDocsGitUrlError {
    success: false;
    error:
        | { type: "MALFORMED_GIT_URL"; url: string }
        | { type: "DOMAIN_NOT_REGISTERED" }
        | { type: "REPO_NOT_CONNECTED" };
}

export type CachedGetDocsGitUrlResult = CachedGetDocsGitUrlSuccess | CachedGetDocsGitUrlError;

/**
 * Cached version of getDocsGitUrl.
 * Git URLs rarely change, so we cache for 1 hour per docs URL.
 * Cache key is only the docs URL — uses fernToken_admin() internally.
 * Git URL lookups are not org-scoped (docs URLs are globally unique),
 * so the admin token works correctly here unlike getDocsSitesForOrg.
 */
export async function getCachedDocsGitUrl(url: DocsUrl): Promise<CachedGetDocsGitUrlResult> {
    "use cache";
    cacheLife("hours");
    cacheTag(`git-url:${url}`);

    // Use admin token for git URL lookups — docs URLs are globally unique
    // so we don't need org-scoped tokens here.
    let token: string;
    try {
        token = fernToken_admin();
    } catch {
        console.error("[getCachedDocsGitUrl] FERN_TOKEN not available");
        return { success: false, error: { type: "REPO_NOT_CONNECTED" } };
    }

    const docsUrlMetadata = await getDocsUrlMetadata({
        url,
        token
    });
    if (!docsUrlMetadata.ok) {
        if (docsUrlMetadata.error.error === "DomainNotRegisteredError") {
            return { success: false, error: { type: "DOMAIN_NOT_REGISTERED" } };
        }
        console.error("Failed to load docs URL metadata", JSON.stringify(docsUrlMetadata.error));
        return {
            success: false,
            error: { type: "MALFORMED_GIT_URL", url: decodeURIComponent(url) }
        };
    }

    if (docsUrlMetadata.body.gitUrl == null) {
        return { success: false, error: { type: "REPO_NOT_CONNECTED" } };
    }

    const parsed = parseGitUrl(docsUrlMetadata.body.gitUrl);
    if (parsed.owner == null || parsed.repo == null || parsed.provider === "unknown") {
        return {
            success: false,
            error: { type: "MALFORMED_GIT_URL", url: docsUrlMetadata.body.gitUrl }
        };
    }

    return { success: true, gitUrl: docsUrlMetadata.body.gitUrl };
}
