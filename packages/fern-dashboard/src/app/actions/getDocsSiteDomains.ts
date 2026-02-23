"use server";

import type { DocsSiteUrl } from "@fern-api/fdr-sdk/orpc-client";
import { getDocsSiteUrl } from "@/utils/getDocsSiteUrl";
import { parseDocsUrlParam } from "@/utils/parseDocsUrlParam";
import { getCurrentSessionOrThrow } from "../services/auth0/getCurrentSession";
import type { Auth0OrgName } from "../services/auth0/types";
import getDocsSitesForOrg from "../services/dal/fdr/getDocsSitesForOrg";

export async function getDocsSiteDomains(docsUrl: string, orgName: Auth0OrgName): Promise<DocsSiteUrl[]> {
    const session = await getCurrentSessionOrThrow();

    const response = await getDocsSitesForOrg({
        orgName,
        token: session.accessToken
    });

    if (!response.ok) {
        throw new Error(`Failed to get docs sites: ${response.error.type}`);
    }

    const parsedDocsUrl = parseDocsUrlParam({ docsUrl });
    const currentDocsSite = response.docsSites.find((site) => getDocsSiteUrl(site) === parsedDocsUrl);

    if (!currentDocsSite) {
        throw new Error(`Docs site not found: ${docsUrl}`);
    }

    return currentDocsSite.urls;
}
