import { FdrAPI } from "@fern-api/fdr-sdk/client/types";

import { getFdrClient } from "@/app/services/fdr/getFdrClient";
import { getHostnameFromUrl } from "@/utils/getHostnameFromUrl";

export default async function postDocsGithubSourceHandler({
    url,
    token,
    gitUrl
}: {
    url: string;
    token: string;
    gitUrl: string;
}): Promise<void> {
    const client = getFdrClient({ token });

    const hostname = getHostnameFromUrl(url);
    console.log("[postDocsGithubSourceHandler] Setting gitUrl for docs:", {
        originalUrl: url,
        hostname,
        gitUrl
    });

    // Use the setDocsUrlMetadata function from the docs read service
    const response = await client.docs.v2.write.setDocsUrlMetadata({
        // NOTE: We have a bug in the service where if we pass in a full URL including its subpath, it will not actually set.
        // To bypass this, we just pass in the hostname and strip off the subpath.
        url: FdrAPI.Url(hostname),
        githubUrl: FdrAPI.Url(gitUrl) // Note: FDR backend still uses 'githubUrl' field name even though it supports GitLab too
    });

    console.log("[postDocsGithubSourceHandler] FDR response:", response);

    if (!response.ok) {
        console.error("Failed to set docs URL metadata", JSON.stringify(response.error));
        throw new Error("Failed to set docs URL metadata");
    }
}
