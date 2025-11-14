import "server-only";

import type { FdrAPI } from "@fern-api/fdr-sdk/client/types";

import { getCurrentSession } from "@/app/services/auth0/getCurrentSession";
import type { Auth0OrgName } from "@/app/services/auth0/types";
import getDocsSitesForOrg from "@/app/services/dal/fdr/getDocsSitesForOrg";
import { getAuthenticatedSessionOrRedirect } from "@/app/services/dal/organization";
import { PosthogFeatureFlag } from "@/components/posthog/feature-flags/flags";
import { isFeatureFlagEnabledForUser } from "@/components/posthog/feature-flags/server-side";
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

    const docsSites: FdrAPI.dashboard.DocsSite[] = response.docsSites;

    const isCreateDocsNewSiteEnabled = await isFeatureFlagEnabledForUser(
        PosthogFeatureFlag.ENABLE_CREATE_DOCS_NEW_SITE,
        session?.user.sub,
        orgName
    );

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
        <DocsNavbarItem
            firstDocsSiteUrlParam={firstDocsSiteUrlParam}
            docsSitesData={docsSitesData}
            orgName={orgName}
            isCreateDocsNewSiteEnabled={isCreateDocsNewSiteEnabled ?? false}
        />
    );
}
