import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";

import * as auth0Management from "@/app/services/auth0/management";
import { throwDigestibleError } from "@/utils/errors";
import orgRedirect from "@/utils/orgRedirect";
import { getCurrentSession } from "../auth0/getCurrentSession";
import type { Auth0OrgName } from "../auth0/types";
import { getVenusClient } from "../venus/getVenusClient";

/**
 * Asserts that the user has access to a given auth0 organization.
 *
 * @throws {DigestibleError} if the user does not have access to the organization
 */
export const assertUserHasOrganizationAccess = cache(async (token: string, orgName: Auth0OrgName) => {
    const orgExists = await auth0Management.doesOrgExist(orgName);
    if (!orgExists) {
        throw throwDigestibleError(new Error("Organization not found"), "ORG_NOT_FOUND");
    }
    const venusClient = getVenusClient({ token });
    const result = await venusClient.organization.isMember(orgName);

    if (result.ok) {
        if (!result.body) {
            throw throwDigestibleError(new Error("user not in org"), "USER_NOT_IN_ORG");
        }
    } else {
        // Log the error before throwing
        console.error("Venus API error:", result.error);

        throw throwDigestibleError(
            new Error("Venus API error: " + (result.error?.toString() ?? "Unknown error")),
            "VENUS_API_ERROR"
        );
    }
});

export const getAuthenticatedSessionOrRedirect = cache(async (orgName: Auth0OrgName) => {
    const session = await getCurrentSession();
    if (session == null) {
        redirect("/");
    }

    if (session.permissions === undefined || session.permissions.length === 0) {
        // Check if we just came from a login redirect to prevent infinite loops.
        // The redirect_on_login cookie is set by middleware when redirecting to /auth/login
        // and indicates we've already attempted to authenticate with org context.
        const cookieStore = await cookies();
        const pendingRedirect = cookieStore.get("redirect_on_login")?.value;

        // This is only to prevent infinite redirect loops. We still need to check
        // if the user has access to the organization. and we can remove this once we
        // backfill know with confidence that all users have at least one permission.
        if (pendingRedirect != null) {
            // We have a pending redirect cookie, meaning we just went through the login flow.
            // If we still have no permissions, we're in a loop - show access denied instead.
            console.error("User has no permissions after login redirect, preventing redirect loop", {
                orgName,
                pendingRedirect
            });
            await assertUserHasOrganizationAccess(session.accessToken, orgName);
            return session;
        }

        const id = await auth0Management.getOrgIdFromName(orgName);
        console.log("Redirecting to org since no permissions found on session", { id, name: orgName });
        redirect(orgRedirect({ id, name: orgName }));
    }

    try {
        await assertUserHasOrganizationAccess(session.accessToken, orgName);
        return session;
    } catch (error) {
        console.error("Failed to assert user has organization access", error);
        notFound();
    }
});
