import "server-only";

import type { DocsSite } from "@fern-api/fdr-sdk/orpc-client";

import { getCurrentSession } from "@/app/services/auth0/getCurrentSession";
import type { Auth0OrgName } from "@/app/services/auth0/types";
import getDocsSitesForOrg from "@/app/services/dal/fdr/getDocsSitesForOrg";
import { getAuthenticatedSessionOrRedirect } from "@/app/services/dal/organization";
import { constructDocsUrlParam } from "@/utils/constructDocsUrlParam";
import { getDocsSiteUrl } from "@/utils/getDocsSiteUrl";

import { DocsNavbarItem } from "./DocsNavbarItem";

export interface DocsSiteData {
    url: string;
    urlParam: string;
}

export async function DocsNavbarItems({ orgName }: { orgName: Auth0OrgName }) {
    const session = await getCurrentSession();
    if (session == null) {
        return null;
    }

    await getAuthenticatedSessionOrRedirect(orgName);

    const response = await getDocsSitesForOrg({
        orgName,
        token: session.accessToken
    });
    if (!response.ok) {
        console.warn("Failed to get docs sites for org: ", JSON.stringify(response.error, null, 2));
        return null;
    }

    const docsSites: DocsSite[] = response.docsSites;

    // Transform docs sites to simple data structure for client
    const docsSitesData: DocsSiteData[] = docsSites.map((docsSite) => {
        const url = getDocsSiteUrl(docsSite);
        return {
            url,
            urlParam: constructDocsUrlParam(url)
        };
    });

    const firstDocsSiteUrlParam = docsSitesData[0]?.urlParam;

    return (
        <DocsNavbarItem firstDocsSiteUrlParam={firstDocsSiteUrlParam} docsSitesData={docsSitesData} orgName={orgName} />
    );
}
