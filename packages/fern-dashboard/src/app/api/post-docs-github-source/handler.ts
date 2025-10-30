import { FdrAPI } from "@fern-api/fdr-sdk/client/types";

import { getFdrClient } from "@/app/services/fdr/getFdrClient";

export default async function postDocsGithubSourceHandler({
    url,
    token,
    githubUrl
}: {
    url: string;
    token: string;
    githubUrl: string;
}): Promise<void> {
    const client = getFdrClient({ token });

    // Pass the full URL including the path to setDocsUrlMetadata
    const response = await client.docs.v2.write.setDocsUrlMetadata({
        url: FdrAPI.Url(url),
        githubUrl: FdrAPI.Url(githubUrl)
    });

    if (!response.ok) {
        console.error("Failed to set docs URL metadata", JSON.stringify(response.error));
        throw new Error("Failed to set docs URL metadata");
    }
}
