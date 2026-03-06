import {
    addRoles,
    addUserRoleForResource,
    getRoles,
    getUserRoles,
    type ResourceRole,
    type Roles,
    removeRoles,
    removeUserRoleForResource,
    type UserRolePerResource
} from "@fern-api/user-permissions";
import { revalidateTag } from "next/cache";

import * as auth0Management from "@/app/services/auth0/management";
import type { Auth0OrgName, Auth0UserID } from "@/app/services/auth0/types";
import { RedisCacheKey } from "@/app/services/redis/cacheKey";
import { redisSet } from "@/app/services/redis/redis";

import {
    type FineGrainedPermissions,
    type OrgLevelPermissions,
    type UpdateUserPermissionsRequest,
    validatePermissions
} from "./validation";

export type UpdateUserPermissionsResult =
    | { ok: true }
    | { ok: false; code: "validation_error" | "invalid_permissions" | "cannot_modify_self" | "error"; message: string };

export interface UpdateUserPermissionsHandlerParams {
    currentUserId: Auth0UserID;
    orgName: Auth0OrgName;
    userId: Auth0UserID;
    permissions: UpdateUserPermissionsRequest["permissions"];
}

export default async function updateUserPermissionsHandler({
    currentUserId,
    orgName,
    userId,
    permissions
}: UpdateUserPermissionsHandlerParams): Promise<UpdateUserPermissionsResult> {
    // Prevent users from modifying their own permissions
    if (currentUserId === userId) {
        return {
            ok: false,
            code: "cannot_modify_self",
            message: "You cannot modify your own permissions."
        };
    }

    // Validate business rules
    const validationResult = validatePermissions(permissions);
    if (!validationResult.valid) {
        return {
            ok: false,
            code: validationResult.code,
            message: validationResult.message
        };
    }

    try {
        const orgId = await auth0Management.getOrgIdFromName(orgName);

        // Fetch current state
        const [currentAuth0Roles, currentResourceRoles] = await Promise.all([
            getRoles({ orgId, userId }),
            getUserRoles({ orgId, userId })
        ]);

        const currentOrgRoles = (currentAuth0Roles.data ?? []).filter(
            (r): r is Exclude<Roles, "fine_grain"> => r !== "fine_grain"
        );
        const currentResources = currentResourceRoles ?? [];

        if (permissions.type === "org") {
            await applyOrgLevelPermissions({
                orgId,
                userId,
                permissions,
                currentOrgRoles,
                currentResources
            });
        } else {
            await applyFineGrainedPermissions({
                orgId,
                userId,
                permissions,
                currentOrgRoles,
                currentResources
            });
        }

        // Invalidate user session
        await redisSet(RedisCacheKey.userSessionInvalidated(userId), true, {
            ttlInSeconds: 60 * 60 * 24 * 365 // 1 year - match token lifetime
        });

        // Invalidate the members cache
        await auth0Management.invalidateCachesAfterUpdatingMemberRoles(orgName);

        // Invalidate cached permission checks for this user (best-effort, non-fatal)
        try {
            revalidateTag(`permissions:${orgName}:${userId}`, "default");
        } catch {
            // revalidateTag may not be available in all contexts (e.g., tests)
        }

        return { ok: true };
    } catch (error) {
        console.error("Failed to update user permissions:", error);
        return {
            ok: false,
            code: "error",
            message: "Failed to update user permissions. Please try again."
        };
    }
}

interface ApplyOrgLevelParams {
    orgId: string;
    userId: Auth0UserID;
    permissions: OrgLevelPermissions;
    currentOrgRoles: Exclude<Roles, "fine_grain">[];
    currentResources: UserRolePerResource[];
}

async function applyOrgLevelPermissions({
    orgId,
    userId,
    permissions,
    currentOrgRoles,
    currentResources
}: ApplyOrgLevelParams): Promise<void> {
    // Step 1: Clear all fine-grained resource roles
    for (const resourceRole of currentResources) {
        await removeUserRoleForResource({
            orgId,
            userId,
            resourceType: resourceRole.resource_type as "docs",
            resourceId: resourceRole.resource_id,
            role: resourceRole.role as ResourceRole
        });
    }

    // Step 2: Calculate and apply org-level role changes
    const newRoles: Exclude<Roles, "fine_grain">[] = [permissions.role];
    if (permissions.cliEnabled && permissions.role === "editor") {
        newRoles.push("cli");
    }

    const rolesToAdd = newRoles.filter((role) => !currentOrgRoles.includes(role));
    const rolesToRemove = currentOrgRoles.filter((role) => !newRoles.includes(role));

    if (rolesToRemove.length > 0) {
        await removeRoles({ userId, orgId, roleNames: rolesToRemove });
    }

    if (rolesToAdd.length > 0) {
        await addRoles({ userId, orgId, roleNames: rolesToAdd });
    }
}

interface ApplyFineGrainedParams {
    orgId: string;
    userId: Auth0UserID;
    permissions: FineGrainedPermissions;
    currentOrgRoles: Exclude<Roles, "fine_grain">[];
    currentResources: UserRolePerResource[];
}

async function applyFineGrainedPermissions({
    orgId,
    userId,
    permissions,
    currentOrgRoles,
    currentResources
}: ApplyFineGrainedParams): Promise<void> {
    // Step 1: Remove all org-level roles
    if (currentOrgRoles.length > 0) {
        await removeRoles({ userId, orgId, roleNames: currentOrgRoles });
    }

    // Step 2: Clear all existing resource roles
    for (const resourceRole of currentResources) {
        await removeUserRoleForResource({
            orgId,
            userId,
            resourceType: resourceRole.resource_type as "docs",
            resourceId: resourceRole.resource_id,
            role: resourceRole.role as ResourceRole
        });
    }

    // Step 3: Add new resource roles
    for (const [resourceId, entry] of Object.entries(permissions.resourceRoles)) {
        // Add the primary role
        await addUserRoleForResource({
            org_id: orgId,
            user_id: userId,
            resource_type: "docs",
            resource_id: resourceId,
            role: entry.role as ResourceRole
        });

        // Add CLI role if enabled and role is editor
        if (entry.cliEnabled && entry.role === "editor") {
            await addUserRoleForResource({
                org_id: orgId,
                user_id: userId,
                resource_type: "docs",
                resource_id: resourceId,
                role: "cli" as ResourceRole
            });
        }
    }
}
