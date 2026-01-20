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

    // Note: redirect_on_login cookie is now handled in middleware
    // (cookies can only be modified in Server Actions, Route Handlers, or Middleware in Next.js 15)

    await applyOrgMappings();
    const response = await getFirstOrgForUser(session);
    if (response.empty) {
        redirect(`/get-started`);
    } else {
        // Use client-side component to check for recent org and redirect
        return <RecentOrgRedirect defaultOrgName={response.orgName} />;
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
