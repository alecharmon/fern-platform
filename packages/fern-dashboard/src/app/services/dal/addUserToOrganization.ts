import "server-only";

import type { Roles } from "@fern-api/user-permissions";
import { addRoles } from "@fern-api/user-permissions";
import { revalidateTag } from "next/cache";

import { addUserToOrgById, invalidateCachesAfterAddingOrgMember } from "@/app/services/auth0/management";
import type { Auth0OrgID, Auth0OrgName, Auth0UserID } from "@/app/services/auth0/types";
import { getVenusClient } from "@/app/services/venus/getVenusClient";

/**
 * Adds a user to an organization in both Auth0 and Venus, and optionally assigns roles.
 * Auth0 is updated first (via management client, no membership required),
 * then Venus (which checks Auth0 membership before allowing the call).
 * If roles are provided, they are assigned after the user is added to the org.
 * This is shared logic used by the Postman hotlink flow and onboarding flow.
 */
export async function addUserToFernAndAuth0Organization({
    userId,
    orgId,
    auth0OrgId,
    accessToken,
    roles,
    orgName
}: {
    userId: Auth0UserID;
    orgId: string;
    auth0OrgId: Auth0OrgID;
    accessToken: string;
    roles?: Roles[];
    orgName?: Auth0OrgName;
}): Promise<void> {
    // Add to Auth0 first — the management client doesn't require existing membership.
    // Venus checks Auth0 membership before allowing addUser, so Auth0 must come first.
    await addUserToOrgById(userId, auth0OrgId);
    const venus = getVenusClient({ token: accessToken });
    await venus.organization.addUser({ orgId, userId });

    // Invalidate Redis caches so the org layout doesn't serve stale "user not in org" responses
    if (orgName != null) {
        await invalidateCachesAfterAddingOrgMember(userId, orgName);
        revalidateTag(`permissions:${orgName}:${userId}`);
    }

    // Assign roles if provided
    if (roles != null && roles.length > 0) {
        try {
            await addRoles({
                userId,
                orgId: auth0OrgId,
                roleNames: roles
            });
        } catch (error) {
            console.error(`[addUserToFernAndAuth0Organization] Failed to assign roles to user ${userId}:`, error);
        }
    }
}
