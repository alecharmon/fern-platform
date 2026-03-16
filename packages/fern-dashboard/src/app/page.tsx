import { redirect } from "next/navigation";

import { RecentOrgRedirect } from "@/components/auth/RecentOrgRedirect";
import { applyOrgMappings } from "@/orgMappings";
import orgRedirect from "@/utils/orgRedirect";

import { getCurrentSession } from "./services/auth0/getCurrentSession";
import { getMyOrganizations } from "./services/auth0/management";
import { getRecentPath } from "./services/auth0/recentPath";
import { redirectToLogin } from "./services/auth0/redirectToLogin";
import { Auth0OrgID, Auth0OrgName } from "./services/auth0/types";

export default async function Page() {
    const session = await getCurrentSession();

    if (session == null) {
        await redirectToLogin();
        return;
    }

    // Note: redirect_on_login cookie is now handled in middleware
    // (cookies can only be modified in Server Actions, Route Handlers, or Middleware in Next.js 15)

    await applyOrgMappings();

    const organizations = await getMyOrganizations(session.user.sub);
    const firstOrg = organizations[0];

    if (!firstOrg) {
        redirect(`/get-started`);
    }

    const orgName = Auth0OrgName(firstOrg.name);
    const orgId = Auth0OrgID(firstOrg.id);

    // If the session doesn't have an orgId, proactively trigger org-scoped auth
    // so the user gets an org-scoped token in a single flow instead of being
    // redirected to Auth0's Universal Login a second time from OrgLayout.
    if (!session.orgId) {
        redirect(orgRedirect({ id: orgId, name: orgName }));
    }

    // Check Redis for server-side instant redirect (avoids client-side flash)
    const recentPath = await getRecentPath(session.user.sub);
    if (recentPath) {
        const orgNames = organizations.map((org) => org.name as string);
        if (orgNames.includes(recentPath.orgName) && recentPath.path.startsWith(`/${recentPath.orgName}/`)) {
            redirect(recentPath.path);
        }
    }

    // First visit or stale Redis — fall back to client-side redirect
    return <RecentOrgRedirect defaultOrgName={orgName} userId={session.user.sub} />;
}
