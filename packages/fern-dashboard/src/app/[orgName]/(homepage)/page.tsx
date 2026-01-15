import { permanentRedirect, redirect } from "next/navigation";
import { getAvailableOrgsForUser } from "@/app/services/dal/fdr/getAvailableOrgsForUser";
import orgRedirect from "@/utils/orgRedirect";

import { getCurrentSession } from "../../services/auth0/getCurrentSession";
import type { Auth0OrgName } from "../../services/auth0/types";

export default async function Page({ params }: { params: Promise<{ orgName: Auth0OrgName }> }) {
    const session = await getCurrentSession();
    if (session == null) {
        redirect("/");
    }

    const { orgName } = await params;

    // Ensure we have the auth token for the user for the correct org
    const organizations = await getAvailableOrgsForUser({
        userId: session.user.sub
    });
    const currentOrgID = organizations.find((org) => org.name === orgName)?.id ?? undefined;
    if (currentOrgID !== session.orgId && orgName != null && currentOrgID != null) {
        redirect(orgRedirect({ id: currentOrgID, name: orgName }));
    }

    permanentRedirect(`/${orgName}/docs`);
}
