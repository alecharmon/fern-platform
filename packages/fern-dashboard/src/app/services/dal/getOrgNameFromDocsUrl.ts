import "server-only";

import { getDocsUrlMetadata } from "@/app/api/utils/getDocsUrlMetadata";
import { Auth0OrgName } from "@/app/services/auth0/types";
import type { DocsUrl } from "@/utils/types";

/**
 * Resolves the org name that owns a given docs URL using a service token (FERN_TOKEN).
 * This does not require the calling user to be a member of the org.
 */
export async function getOrgNameFromDocsUrl(docsUrl: DocsUrl): Promise<Auth0OrgName | undefined> {
    const fernToken = process.env.FERN_TOKEN;
    if (!fernToken) {
        console.error("[getOrgNameFromDocsUrl] FERN_TOKEN is not configured");
        return undefined;
    }

    const metadata = await getDocsUrlMetadata({ url: docsUrl, token: fernToken });
    if (!metadata.ok) {
        console.error("[getOrgNameFromDocsUrl] Failed to resolve org from docsUrl:", JSON.stringify(metadata.error));
        return undefined;
    }

    return Auth0OrgName(metadata.body.org);
}
