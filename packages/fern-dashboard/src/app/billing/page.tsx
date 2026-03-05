import { redirect } from "next/navigation";

import { RecentOrgRedirect } from "@/components/auth/RecentOrgRedirect";
import { applyOrgMappings } from "@/orgMappings";
import orgRedirect from "@/utils/orgRedirect";

import { type Auth0SessionData, getCurrentSession } from "../services/auth0/getCurrentSession";
import { getMyOrganizations } from "../services/auth0/management";
import { Auth0OrgID, Auth0OrgName } from "../services/auth0/types";

export default async function BillingPage() {
    const session = await getCurrentSession();

    if (session == null) {
        redirect("/login?redirect_on_login=%2Fbilling");
    }

    await applyOrgMappings();
    const response = await getFirstOrgForUser(session);
    if (response.empty) {
        redirect(`/get-started`);
    }

    // If the session doesn't have an orgId, proactively trigger org-scoped auth
    // so the user gets an org-scoped token in a single flow instead of being
    // redirected to Auth0's Universal Login a second time from OrgLayout.
    if (!session.orgId) {
        redirect(orgRedirect({ id: response.orgId, name: response.orgName }, "/billing"));
    }

    // Session already has an orgId — use client-side redirect for recent-org support
    return <RecentOrgRedirect defaultOrgName={response.orgName} userId={session.user.sub} targetPath="/billing" />;
}

async function getFirstOrgForUser(
    session: Auth0SessionData
): Promise<{ empty: true } | { empty: false; orgName: Auth0OrgName; orgId: Auth0OrgID }> {
    const organizations = await getMyOrganizations(session.user.sub);
    const firstOrg = organizations[0];
    if (firstOrg != null) {
        return {
            empty: false,
            orgName: Auth0OrgName(firstOrg.name),
            orgId: Auth0OrgID(firstOrg.id)
        };
    }
    return {
        empty: true
    };
}
