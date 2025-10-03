import "server-only";

import { getCurrentSession } from "@/app/services/auth0/getCurrentSession";
import { Auth0OrgName } from "@/app/services/auth0/types";
import getDocsSitesForOrg from "@/app/services/dal/fdr/getDocsSitesForOrg";
import { parseDocsUrlParam } from "@/utils/parseDocsUrlParam";

import { DocsSiteSelect } from "./DocsSiteSelect";

export async function DocsSiteSwitcher({ orgName, docsUrl }: Readonly<{ orgName: Auth0OrgName; docsUrl?: string }>) {
    const session = await getCurrentSession();
    if (session == null) {
        return null;
    }

    const response = await getDocsSitesForOrg({
        orgName,
        token: session.accessToken
    });
    if (!response.ok) {
        console.warn("Failed to get docs sites for org: ", JSON.stringify(response.error, null, 2));
        return null;
    }

    return (
        <DocsSiteSelect
            docsSites={response.docsSites}
            currentDocsUrl={docsUrl != null ? parseDocsUrlParam({ docsUrl: docsUrl }) : undefined}
        />
    );
}
