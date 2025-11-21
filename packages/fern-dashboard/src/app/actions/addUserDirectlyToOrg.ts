"use server";

import * as auth0Management from "@/app/services/auth0/management";

import { getCurrentSessionOrThrow } from "../services/auth0/getCurrentSession";
import type { Auth0OrgName } from "../services/auth0/types";
import { assertUserHasOrganizationAccess } from "../services/dal/organization";

export async function addUserDirectlyToOrg({ email, orgName }: { email: string; orgName: Auth0OrgName }) {
    const session = await getCurrentSessionOrThrow();

    // Check if user is a Fern employee
    const isFernAdmin = await auth0Management.isFernEmployee(session.user.sub);
    if (!isFernAdmin) {
        throw new Error("Only Fern employees can add users directly to organizations");
    }

    // Still check if the user has access to the organization
    await assertUserHasOrganizationAccess(session.accessToken, orgName);

    // Find the user by email and get their user ID
    const userId = await auth0Management.getUserIdByEmail(email);

    // Add user directly to the organization
    await auth0Management.addUserToOrg(userId, orgName);

    return {
        userId,
        userEmail: email
    };
}
