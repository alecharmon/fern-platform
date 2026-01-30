import { redirect } from "next/navigation";

import { DeepLinkRedirect } from "@/components/auth/DeepLinkRedirect";
import { applyOrgMappings } from "@/orgMappings";

import { type Auth0SessionData, getCurrentSession } from "../services/auth0/getCurrentSession";
import { getMyOrganizations } from "../services/auth0/management";
import { redirectToLogin } from "../services/auth0/redirectToLogin";
import { Auth0OrgName } from "../services/auth0/types";

export default async function Page() {
    const session = await getCurrentSession();

    if (session == null) {
        return await redirectToLogin();
    }

    await applyOrgMappings();
    const response = await getFirstOrgForUser(session);
    if (response.empty) {
        redirect(`/get-started`);
    } else {
        return <DeepLinkRedirect defaultOrgName={response.orgName} targetPath="/members" userId={session.user.sub} />;
    }
}

async function getFirstOrgForUser(
    session: Auth0SessionData
): Promise<{ empty: true } | { empty: false; orgName: Auth0OrgName }> {
    const organizations = await getMyOrganizations(session.user.sub);
    const firstOrg = organizations[0];
    if (firstOrg != null) {
        return {
            empty: false,
            orgName: Auth0OrgName(firstOrg.name)
        };
    }
    return {
        empty: true
    };
}
