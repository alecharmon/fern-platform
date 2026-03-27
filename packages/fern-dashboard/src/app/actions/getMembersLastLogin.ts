"use server";

import * as auth0Management from "@/app/services/auth0/management";

import { getCurrentSessionOrThrow } from "../services/auth0/getCurrentSession";
import type { Auth0OrgName } from "../services/auth0/types";
import { assertUserHasOrganizationAccess } from "../services/dal/organization";

/**
 * Server action to fetch last_login times for org members.
 * Returns a map of user_id -> last_login ISO string.
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

    return auth0Management.getMembersLastLogin(userIds);
}
