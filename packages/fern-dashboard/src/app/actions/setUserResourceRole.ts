"use server";

import { addUserRoleForResource, type ResourceRole, removeUserRoleForResource } from "@fern-api/user-permissions";
import { getCurrentSessionOrThrow } from "@/app/services/auth0/getCurrentSession";
import { getOrgIdFromName } from "@/app/services/auth0/management";
import type { Auth0OrgName, Auth0UserID } from "@/app/services/auth0/types";
import { assertUserHasOrganizationAccess } from "@/app/services/dal/organization";

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

        // Remove previous role if it exists
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

        return { success: true };
    } catch (error) {
        console.error("Failed to set user resource role:", error);
        return {
            success: false,
            error: error instanceof Error ? error.message : "Unknown error"
        };
    }
}
