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
    githubUrl,
    orgName: providedOrgName
}: {
    url: string;
    token: string;
    githubUrl: string;
    /** Optional: provide org name directly to skip FDR lookup (useful during onboarding when docs site doesn't exist yet) */
    orgName?: string;
}): Promise<PostDocsGithubSourceResponse> {
    console.log(
        `[postDocsGithubSourceHandler] Starting link: url=${url}, githubUrl=${githubUrl}, providedOrgName=${providedOrgName}`
    );

    // Get the organization that owns this docs URL
    // If orgName is provided (e.g., during onboarding), use it directly to avoid FDR lookup
    // which would fail if the docs site hasn't been published yet
    let orgName: string;
    if (providedOrgName) {
        orgName = providedOrgName;
        console.log(`[postDocsGithubSourceHandler] Using provided orgName=${orgName}`);
    } else {
        const result = await getDocsUrlOwner({ url: url as DocsUrl, token });
        orgName = result.orgName;
        console.log(`[postDocsGithubSourceHandler] Looked up orgName=${orgName} from FDR`);
    }
    const site = parseDocsUrlParam({ docsUrl: url });
    console.log(`[postDocsGithubSourceHandler] site=${site}`);

    // Use the unified validation function (same as input validation)
    const validationResult = await validateGitRepoAccess(orgName, site, githubUrl);

    if (!validationResult.ok) {
        console.error(
            `[postDocsGithubSourceHandler] Access validation failed: ${validationResult.error.type}`,
            JSON.stringify(validationResult.error, null, 2)
        );
        return { ok: false, error: validationResult.error };
    }
    console.log(`[postDocsGithubSourceHandler] Validation passed, provider=${validationResult.provider}`);

    const client = getFdrClient({ token });

    // Use the setDocsUrlMetadata function from the docs read service
    const hostnameUrl = getHostnameFromUrl(url);
    const canonicalGithubUrl = validationResult.canonicalUrl;
    console.log(
        `[postDocsGithubSourceHandler] Calling FDR setDocsUrlMetadata: url=${hostnameUrl}, githubUrl=${canonicalGithubUrl}`
    );

    try {
        await client.docs.v2.write.setDocsUrlMetadata({
            // NOTE: We have a bug in the service where if we pass in a full URL including its subpath, it will not actually set.
            // To bypass this, we just pass in the hostname and strip off the subpath.
            url: FdrAPI.Url(hostnameUrl),
            githubUrl: FdrAPI.Url(canonicalGithubUrl)
        });
    } catch (e: unknown) {
        const errorMessage = e instanceof Error ? e.message : JSON.stringify(e);
        console.error("[postDocsGithubSourceHandler] Failed to set docs URL metadata:", errorMessage);
        return {
            ok: false,
            error: { type: "UNEXPECTED_ERROR", message: errorMessage }
        };
    }

    console.log(`[postDocsGithubSourceHandler] Successfully set metadata, invalidating cache...`);
    // Invalidate the GitHub loader cache to ensure fresh data on next load
    await invalidateGithubLoaderCache(githubUrl);
    console.log(`[postDocsGithubSourceHandler] Done!`);
    return { ok: true };
}
