"use server";

import {
    addUserRoleForResource,
    getRoles,
    type ResourceRole,
    type Roles,
    removeRoles,
    removeUserRoleForResource
} from "@fern-api/user-permissions";
import { getCurrentSessionOrThrow } from "@/app/services/auth0/getCurrentSession";
import { getOrgIdFromName } from "@/app/services/auth0/management";
import type { Auth0OrgName, Auth0UserID } from "@/app/services/auth0/types";
import { assertUserHasOrganizationAccess } from "@/app/services/dal/organization";
import { RedisCacheKey } from "@/app/services/redis/cacheKey";
import { redisSet } from "@/app/services/redis/redis";

export interface SetUserResourceRoleParams {
    orgName: Auth0OrgName;
    userId: Auth0UserID;
    resourceType: "docs";
    resourceId: string;
    role: ResourceRole;
    previousRole?: ResourceRole;
}

export async function setUserResourceRole({
    orgName,
    userId,
    resourceType,
    resourceId,
    role,
    previousRole
}: SetUserResourceRoleParams): Promise<{ success: boolean; error?: string }> {
    try {
        const session = await getCurrentSessionOrThrow();
        await assertUserHasOrganizationAccess(session.accessToken, orgName);

        const orgId = await getOrgIdFromName(orgName);

        // Remove all org-level roles to avoid conflicts with fine-grained permissions
        const currentRoles = await getRoles({ orgId, userId });
        const orgLevelRoles = (currentRoles.data ?? []).filter(
            (r): r is Exclude<Roles, "fine_grain"> => r !== "fine_grain"
        );
        if (orgLevelRoles.length > 0) {
            await removeRoles({ userId, orgId, roleNames: orgLevelRoles });
        }

        // Remove previous resource role if it exists
        if (previousRole) {
            try {
                await removeUserRoleForResource({
                    orgId,
                    userId,
                    resourceType,
                    resourceId,
                    role: previousRole
                });
            } catch (error) {
                console.warn("Failed to remove previous role:", error);
                // Continue anyway - the role might not exist
            }
        }

        // Add the new role
        await addUserRoleForResource({
            org_id: orgId,
            user_id: userId,
            resource_type: resourceType,
            resource_id: resourceId,
            role
        });

        // Set Redis flag to invalidate user's session
        // This will be checked by the TokenRefresher to log the user out
        await redisSet(RedisCacheKey.userSessionInvalidated(userId), true, {
            ttlInSeconds: 60 * 60 * 24 * 365 // 1 year - match token lifetime
        });

        return { success: true };
    } catch (error) {
        console.error("Failed to set user resource role:", error);
        return {
            success: false,
            error: error instanceof Error ? error.message : "Unknown error"
        };
    }
}
