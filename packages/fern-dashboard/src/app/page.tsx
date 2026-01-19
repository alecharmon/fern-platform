import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { RecentOrgRedirect } from "@/components/auth/RecentOrgRedirect";
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
        // Clear the cookie immediately to prevent redirect loops (e.g., if user isn't a member and gets redirected to GitHub)
        cookieStore.delete("redirect_on_login");
        redirect(pendingRedirect);
    } else {
        await applyOrgMappings();
        const response = await getFirstOrgForUser(session);
        if (response.empty) {
            redirect(`/get-started`);
        } else {
            // Use client-side component to check for recent org and redirect
            return <RecentOrgRedirect defaultOrgName={response.orgName} />;
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
