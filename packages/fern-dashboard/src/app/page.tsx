import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { applyOrgMappings } from "@/orgMappings";

import { type Auth0SessionData, getCurrentSession } from "./services/auth0/getCurrentSession";
import { getMyOrganizations } from "./services/auth0/management";
import { Auth0OrgName } from "./services/auth0/types";

export default async function Page() {
    const session = await getCurrentSession();

    if (session == null) {
        redirect("/login");
    }

    // Check if there's a pending org redirect from invitation flow
    const cookieStore = await cookies();
    const pendingRedirect = cookieStore.get("redirect_on_login")?.value;

    if (pendingRedirect) {
        // Redirect to the invited organization (cookie will be cleared by middleware on next request)
        redirect(pendingRedirect);
    } else {
        await applyOrgMappings();
        const response = await getFirstOrgForUser(session);
        if (response.empty) {
            redirect(`/get-started`);
        } else {
            redirect(`/${response.orgName}/docs`);
        }
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
