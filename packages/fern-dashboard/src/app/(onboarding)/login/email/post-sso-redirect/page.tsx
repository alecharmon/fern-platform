import { getEmailLoginConfig } from "@fern-docs/edge-config";
import { redirect } from "next/navigation";

import getMyOrganizations from "@/app/api/get-my-organizations/handler";
import { getCurrentSession } from "@/app/services/auth0/getCurrentSession";
import { addUserToOrgById, invalidateCachesAfterAddingOrgMember } from "@/app/services/auth0/management";
import { Auth0OrgID, type Auth0OrgName, Auth0UserID } from "@/app/services/auth0/types";
import { getVenusClient } from "@/app/services/venus/getVenusClient";
import orgRedirect from "@/utils/orgRedirect";
import type { EmailLoginSsoEntry } from "../../../../../../../fern-docs/edge-config/src/getEmailLoginConfig";
import { attemptGroupPermSync, attemptOrgLevelRole } from "./permission-sync";
import SilentReauthLoader from "./SilentReauthLoader";

function asString(value: string | string[] | undefined): string | undefined {
    return typeof value === "string" ? value : undefined;
}

async function getOrgForConnection(connection: string): Promise<EmailLoginSsoEntry | undefined> {
    const { connectionToOrg, byEmailDomain } = await getEmailLoginConfig();
    const mappedOrg = connectionToOrg[connection];
    if (mappedOrg != null) {
        return mappedOrg;
    }

    return Object.values(byEmailDomain).find((entry) => entry.connection === connection);
}

export default async function PostSsoRedirectPage({
    searchParams
}: {
    searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
    const resolvedSearchParams = await searchParams;
    const connection = asString(resolvedSearchParams.connection);

    if (!connection) {
        redirect("/");
    }

    const session = await getCurrentSession();
    if (session == null) {
        redirect("/login");
    }

    const orgMapping = await getOrgForConnection(connection);
    if (!orgMapping) {
        console.error("Failed to resolve org for connection", { connection });
        redirect("/");
    }

    // Always redirect to the org's home page based on SSO config.
    // Use silent: false because the user just authenticated via SSO and their
    // token isn't org-scoped yet — prompt=none fails for freshly provisioned users.
    const destination = orgRedirect(
        { id: orgMapping.org_id as Auth0OrgID, name: orgMapping.org_name as Auth0OrgName },
        "",
        { silent: false }
    );

    const userId = Auth0UserID(session.user.sub);
    const orgId = Auth0OrgID(orgMapping.org_id);

    try {
        const orgs = await getMyOrganizations(userId);
        const alreadyInOrg = orgs.some((org) => org.id === orgId);

        if (!alreadyInOrg) {
            const venus = getVenusClient({ token: session.accessToken ?? "" });

            await venus.organization.addUser({
                orgId,
                userId
            });

            await addUserToOrgById(userId, orgId);
            // Invalidate the cached org membership so the org layout doesn't
            // serve a stale "user not in org" response after the redirect.
            await invalidateCachesAfterAddingOrgMember(userId, orgMapping.org_name as Auth0OrgName);
        }
    } catch (error) {
        console.error("Failed to add user to org after SSO", {
            error,
            orgId,
            userId
        });
    }

    if (orgMapping.use_group_mappings) {
        await attemptGroupPermSync({ userId, orgId, connection });
    } else {
        await attemptOrgLevelRole({ userId, orgId, defaultRole: orgMapping.default_role });
    }

    // Show loading UI while polling for org-scoped token via silent re-auth
    // This handles the case where permissions were just synced but the token
    // doesn't yet reflect the org membership
    return <SilentReauthLoader orgId={orgId} destination={destination} />;
}
