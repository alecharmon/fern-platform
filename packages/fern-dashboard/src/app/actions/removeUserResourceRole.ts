"use server";

import { type ResourceRole, removeUserRoleForResource } from "@fern-api/user-permissions";
import { getCurrentSessionOrThrow } from "@/app/services/auth0/getCurrentSession";
import { getOrgIdFromName } from "@/app/services/auth0/management";
import type { Auth0OrgName, Auth0UserID } from "@/app/services/auth0/types";
import { assertUserHasOrganizationAccess } from "@/app/services/dal/organization";

export interface RemoveUserResourceRoleParams {
    orgName: Auth0OrgName;
    userId: Auth0UserID;
    resourceType: "docs";
    resourceId: string;
    role: ResourceRole;
}

export async function removeUserResourceRole({
    orgName,
    userId,
    resourceType,
    resourceId,
    role
}: RemoveUserResourceRoleParams): Promise<{ success: boolean; error?: string }> {
    try {
        const session = await getCurrentSessionOrThrow();
        await assertUserHasOrganizationAccess(session.accessToken, orgName);

        const orgId = await getOrgIdFromName(orgName);

        await removeUserRoleForResource({
            orgId,
            userId,
            resourceType,
            resourceId,
            role
        });

        return { success: true };
    } catch (error) {
        console.error("Failed to remove user resource role:", error);
        return {
            success: false,
            error: error instanceof Error ? error.message : "Unknown error"
        };
    }
}
