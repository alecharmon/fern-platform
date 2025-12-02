import { FdrAPI } from "@fern-api/fdr-sdk/client/types";

import { invalidateGithubLoaderCache } from "@/app/services/dal/github/invalidateGithubLoaderCache";
import { getFdrClient } from "@/app/services/fdr/getFdrClient";
import { getHostnameFromUrl } from "@/utils/getHostnameFromUrl";

export default async function postDocsGithubSourceHandler({
    url,
    token,
    githubUrl
}: {
    url: string;
    token: string;
    githubUrl: string;
}): Promise<{ success: boolean; error?: string }> {
    const client = getFdrClient({ token });

    // Use the setDocsUrlMetadata function from the docs read service
    const response = await client.docs.v2.write.setDocsUrlMetadata({
        // NOTE: We have a bug in the service where if we pass in a full URL including its subpath, it will not actually set.
        // To bypass this, we just pass in the hostname and strip off the subpath.
        url: FdrAPI.Url(getHostnameFromUrl(url)),
        githubUrl: FdrAPI.Url(githubUrl)
    });

    if (!response.ok) {
        const errorMessage = JSON.stringify(response.error);
        console.error("Failed to set docs URL metadata", errorMessage);
        return { success: false, error: errorMessage };
    }

    // Invalidate the GitHub loader cache to ensure fresh data on next load
    await invalidateGithubLoaderCache(githubUrl);
    return { success: true };
}
