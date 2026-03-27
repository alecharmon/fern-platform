"use server";

import * as auth0Management from "@/app/services/auth0/management";

import { getCurrentSessionOrThrow } from "../services/auth0/getCurrentSession";
import type { Auth0OrgName } from "../services/auth0/types";
import { assertUserHasOrganizationAccess } from "../services/dal/organization";

/**
 * Server action to fetch last_login times for org members.
 * Returns a map of user_id -> last_login ISO string.
 *
 * Validates that the provided userIds are actual members of the org
 * to prevent IDOR (querying last_login for users outside the org).
 */
export async function getMembersLastLogin({
    orgName,
    userIds
}: {
    orgName: Auth0OrgName;
    userIds: string[];
}): Promise<Record<string, string>> {
    const session = await getCurrentSessionOrThrow();
    await assertUserHasOrganizationAccess(session.accessToken, orgName);

    // Validate userIds are actual org members to prevent IDOR
    const orgMembers = await auth0Management.getOrgMembers(orgName, { includeFernEmployees: true });
    const orgMemberIds = new Set(orgMembers.map((m) => m.user_id));
    const validUserIds = userIds.filter((id) => orgMemberIds.has(id));

    return auth0Management.getMembersLastLogin(validUserIds);
}
