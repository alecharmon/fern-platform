"use server";

import { fernToken_admin } from "@fern-api/docs-server";

import { getDocsUrlMetadata } from "../api/utils/getDocsUrlMetadata";
import { getCurrentSessionOrThrow } from "../services/auth0/getCurrentSession";

export async function checkDocsUrlAvailability(docsUrl: string): Promise<{
    available: boolean;
    error?: string;
}> {
    try {
        const session = await getCurrentSessionOrThrow();
        const decodedUrl = decodeURIComponent(docsUrl);

        const url = `${decodedUrl}.docs.buildwithfern.com`;
        const docsMetadata = await getDocsUrlMetadata({
            url: url,
            token: fernToken_admin() ?? session.accessToken
        });
        // If the metadata returns ok: false, the URL is available (not claimed)
        if (!docsMetadata.ok) {
            return { available: true };
        }

        // If we got metadata back, the URL is already claimed
        return { available: false };
    } catch (error) {
        console.error("Failed to check docs URL availability", error);
        return {
            available: false,
            error: error instanceof Error ? error.message : "Unknown error occurred"
        };
    }
}
