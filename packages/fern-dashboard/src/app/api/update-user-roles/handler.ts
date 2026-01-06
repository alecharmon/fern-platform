import { addRoles, type Roles, removeRoles } from "@fern-api/user-permissions";

import * as auth0Management from "@/app/services/auth0/management";
import type { Auth0OrgName, Auth0UserID } from "@/app/services/auth0/types";

export type UpdateUserRolesResult = { ok: true } | { ok: false; code: "cannot_modify_self" | "error"; message: string };

export default async function updateUserRolesHandler({
    currentUserId,
    orgName,
    userId,
    currentRoles,
    newRoles
}: {
    currentUserId: Auth0UserID;
    orgName: Auth0OrgName;
    userId: Auth0UserID;
    currentRoles: Roles[];
    newRoles: Roles[];
}): Promise<UpdateUserRolesResult> {
    // Prevent users from modifying their own roles
    if (currentUserId === userId) {
        return {
            ok: false,
            code: "cannot_modify_self",
            message: "You cannot modify your own roles."
        };
    }

    const orgId = await auth0Management.getOrgIdFromName(orgName);

    // Calculate roles to add and remove
    const rolesToAdd = newRoles.filter((role) => !currentRoles.includes(role));
    const rolesToRemove = currentRoles.filter((role) => !newRoles.includes(role));

    try {
        if (rolesToRemove.length > 0) {
            await removeRoles({ userId, orgId, roleNames: rolesToRemove });
        }

        if (rolesToAdd.length > 0) {
            await addRoles({ userId, orgId, roleNames: rolesToAdd });
        }

        // Invalidate the members cache so the updated roles are fetched
        await auth0Management.invalidateCachesAfterUpdatingMemberRoles(orgName);

        return { ok: true };
    } catch (error) {
        console.error("Failed to update user roles:", error);
        return {
            ok: false,
            code: "error",
            message: "Failed to update user roles. Please try again."
        };
    }
}
