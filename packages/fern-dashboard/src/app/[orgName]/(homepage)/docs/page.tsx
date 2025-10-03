import { redirect } from "next/navigation";

import { Auth0OrgName } from "@/app/services/auth0/types";
import getDocsSitesForOrg from "@/app/services/dal/fdr/getDocsSitesForOrg";
import { getAuthenticatedSessionOrRedirect } from "@/app/services/dal/organization";
import { DocsZeroState } from "@/components/docs-page/DocsZeroState";
import { constructDocsUrlParam } from "@/utils/constructDocsUrlParam";
import { getDocsSiteUrl } from "@/utils/getDocsSiteUrl";

export default async function Page({ params }: { params: Promise<{ orgName: Auth0OrgName }> }) {
    const { orgName } = await params;
    const session = await getAuthenticatedSessionOrRedirect(orgName);

    const response = await getDocsSitesForOrg({
        orgName,
        token: session.accessToken
    });
    if (!response.ok) {
        console.warn("Failed to get docs sites for org: ", JSON.stringify(response.error, null, 2));
        return <DocsZeroState user={session.user} />;
    }

    const docsSites = response.docsSites;

    const firstDocsSite = docsSites[0];
    if (firstDocsSite != null) {
        redirect(`/${orgName}/docs/${constructDocsUrlParam(getDocsSiteUrl(firstDocsSite))}`);
    }

    return <DocsZeroState user={session.user} />;
}
