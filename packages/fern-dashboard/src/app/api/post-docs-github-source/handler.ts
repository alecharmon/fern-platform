import { FdrAPI } from "@fern-api/fdr-sdk/client/types";

import { type GitRepoValidationError, validateGitRepoAccess } from "@/app/services/dal/git/validateGitRepoAccess";
import { invalidateGithubLoaderCache } from "@/app/services/dal/github/invalidateGithubLoaderCache";
import { getFdrClient } from "@/app/services/fdr/getFdrClient";
import { getHostnameFromUrl } from "@/utils/getHostnameFromUrl";
import { parseDocsUrlParam } from "@/utils/parseDocsUrlParam";
import type { DocsUrl } from "@/utils/types";

import { getDocsUrlOwner } from "../utils/getDocsUrlMetadata";

export type PostDocsGithubSourceResponse =
    | { ok: true }
    | {
          ok: false;
          error: GitRepoValidationError;
      };

export default async function postDocsGithubSourceHandler({
    url,
    token,
    githubUrl
}: {
    url: string;
    token: string;
    githubUrl: string;
}): Promise<PostDocsGithubSourceResponse> {
    // Get the organization that owns this docs URL
    const { orgName } = await getDocsUrlOwner({ url: url as DocsUrl, token });
    const site = parseDocsUrlParam({ docsUrl: url });

    // Use the unified validation function (same as input validation)
    const validationResult = await validateGitRepoAccess(orgName, site, githubUrl);

    if (!validationResult.ok) {
        console.error(`Access validation failed: ${validationResult.error.type}`, validationResult.error);
        return { ok: false, error: validationResult.error };
    }

    const client = getFdrClient({ token });

    // Use the setDocsUrlMetadata function from the docs read service
    const response = await client.docs.v2.write.setDocsUrlMetadata({
        // NOTE: We have a bug in the service where if we pass in a full URL including its subpath, it will not actually set.
        // To bypass this, we just pass in the hostname and strip off the subpath.
        url: FdrAPI.Url(getHostnameFromUrl(url)),
        githubUrl: FdrAPI.Url(validationResult.canonicalUrl)
    });

    if (!response.ok) {
        const errorMessage = JSON.stringify(response.error);
        console.error("Failed to set docs URL metadata", errorMessage);
        return {
            ok: false,
            error: { type: "UNEXPECTED_ERROR", message: errorMessage }
        };
    }

    // Invalidate the GitHub loader cache to ensure fresh data on next load
    await invalidateGithubLoaderCache(githubUrl);
    return { ok: true };
}
