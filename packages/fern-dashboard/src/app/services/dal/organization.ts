import { notFound, redirect } from "next/navigation";
import { cache } from "react";

import * as auth0Management from "@/app/services/auth0/management";
import { throwDigestibleError } from "@/utils/errors";
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

    try {
        await assertUserHasOrganizationAccess(session.accessToken, orgName);
        return session;
    } catch (error) {
        console.error("Failed to assert user has organization access", error);
        notFound();
    }
});
