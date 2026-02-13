import jwt from "jsonwebtoken";
import { notFound } from "next/navigation";
import { cache } from "react";

import * as auth0Management from "@/app/services/auth0/management";
import { throwDigestibleError } from "@/utils/errors";
import { getCurrentSession } from "../auth0/getCurrentSession";
import { redirectToLogin } from "../auth0/redirectToLogin";
import { Auth0OrgID, type Auth0OrgName } from "../auth0/types";
import { getVenusClient } from "../venus/getVenusClient";

// Check if user has super-user permission - they have access to all orgs
const getTokenForVenus = (sessionToken: string): string | undefined => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const decodedToken = jwt.decode(sessionToken) as any;
    const permissions: string[] = decodedToken?.permissions ?? [];
    if (auth0Management.isSuperUser(permissions)) {
        return;
    }
    return sessionToken;
};

/**
 * Asserts that the user has access to a given auth0 organization.
 * Super users (with super-user permission) have access to all organizations.
 *
 * @throws {DigestibleError} if the user does not have access to the organization
 */
export const assertUserHasOrganizationAccess = cache(async (token: string, orgName: Auth0OrgName) => {
    const orgExists = await auth0Management.doesOrgExist(orgName);
    if (!orgExists) {
        throw throwDigestibleError(new Error("Organization not found"), "ORG_NOT_FOUND");
    }

    const venusToken = getTokenForVenus(token);
    if (venusToken == null) {
        return;
    }

    const venusClient = getVenusClient({ token: venusToken });
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
        return await redirectToLogin();
    }

    try {
        await assertUserHasOrganizationAccess(session.accessToken, orgName);
        return session;
    } catch (error) {
        console.error("Failed to assert user has organization access", error);
        notFound();
    }
});

/**
 * Retrieves the organization associated with a Postman team ID.
 * Returns a discriminated union indicating success or failure.
 */
export async function getOrganizationForPostmanTeam(
    token: string,
    postmanTeamId: string
): Promise<{ success: true; orgId: Auth0OrgID } | { success: false; message?: string }> {
    const venusToken = getTokenForVenus(token);
    if (venusToken == null) {
        return { success: false, message: "User does not have permission" };
    }

    const venusClient = getVenusClient({ token: venusToken });
    const response = await venusClient.organization.getByPostmanTeamId(postmanTeamId);
    if (response.ok) {
        return { success: true, orgId: Auth0OrgID(response.body.organizationId) };
    }
    return { success: false, message: "Did not find organization for provided postman team id" };
}
