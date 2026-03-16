import "server-only";

import type { DocsSite } from "@fern-api/fdr-sdk/orpc-client";

import { getBasepathRoutes } from "@/app/actions/domainSettings";
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
    domain: string;
    basepath: string | undefined;
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
            urlParam: constructDocsUrlParam(url),
            domain: docsSite.mainUrl.domain,
            basepath: docsSite.mainUrl.path ?? undefined
        };
    });

    // Determine which domains are truly multi-repo by checking Upstash basepath routes
    const uniqueDomains = [...new Set(docsSitesData.map((s) => s.domain))];
    const multiRepoDomains = new Set<string>();
    await Promise.all(
        uniqueDomains.map(async (domain) => {
            try {
                const basepaths = await getBasepathRoutes({ domain, orgName });
                if (basepaths != null && basepaths.length > 1) {
                    multiRepoDomains.add(domain);
                }
            } catch {
                // If we can't check, don't group this domain
            }
        })
    );

    const firstDocsSiteUrlParam = docsSitesData[0]?.urlParam;

    return (
        <DocsNavbarItem
            firstDocsSiteUrlParam={firstDocsSiteUrlParam}
            docsSitesData={docsSitesData}
            orgName={orgName}
            multiRepoDomains={[...multiRepoDomains]}
        />
    );
}
