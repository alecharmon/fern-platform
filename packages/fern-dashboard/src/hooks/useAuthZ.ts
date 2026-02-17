"use client";

import {
    type AuthZPermission,
    createScopedPermission,
    getPermissionsFromSession,
    hasPermission,
    parseScopedPermission,
    type ResourceType
} from "@fern-api/user-permissions";
import { useQuery } from "@tanstack/react-query";
import { DashboardApiClient } from "@/app/services/dashboard-api/client";
import { convertQueryResultToLoadable } from "@/state/convertQueryResultToLoadable";

export interface UseAuthZResult {
    /**
     * The current user's ID.
     */
    userId: string | undefined;

    /**
     * The current org name from the session.
     */
    orgName: string | undefined;

    /**
     * Whether fine-grained permissions feature is enabled for this user/org.
     */
    isFineGrainedPermissionsEnabled: boolean;

    /**
     * Whether permissions are enforced (access denied on missing permissions).
     * When false, permissions are checked but not enforced (logging only).
     */
    isEnforcePermissions: boolean;

    /**
     * Raw session permissions (includes both org-level and scoped permissions).
     */
    sessionPermissions: string[];

    /**
     * Org-level permissions only.
     */
    permissions: AuthZPermission[];

    /**
     * Check if user has an org-level permission.
     * Super-user grants all permissions.
     */
    has: (permission: AuthZPermission) => boolean;

    /**
     * Check if user has permission for a specific resource.
     * Checks in order: super-user → org-level permission → resource-scoped permission.
     * Note: This is a client-side check using session permissions only.
     * Server-side checks should use the async hasResourcePermission for Supabase integration.
     */
    hasResource: (permission: AuthZPermission, resourceType: ResourceType, resourceId: string) => boolean;

    /**
     * Get all resource IDs the user has a specific permission for.
     * Returns { type: "all" } if user has org-level permission,
     * or { type: "specific", resourceIds: [...] } for scoped permissions only.
     * Note: This is a client-side check using session permissions only.
     */
    getPermittedResources: (
        permission: AuthZPermission,
        resourceType: ResourceType
    ) => { type: "all" } | { type: "specific"; resourceIds: string[] };
}

/**
 * Client-side resource permission check using session permissions only.
 * Does not call Supabase - for server-side checks with Supabase, use hasResourcePermission directly.
 */
function hasResourcePermissionFromSession({
    sessionPermissions,
    orgPermissions,
    permissionToCheck,
    resourceType,
    resourceId
}: {
    sessionPermissions: string[];
    orgPermissions: AuthZPermission[];
    permissionToCheck: AuthZPermission;
    resourceType: ResourceType;
    resourceId: string;
}): boolean {
    // Check org-level permission first (cascades to all resources)
    if (hasPermission(orgPermissions, permissionToCheck)) {
        return true;
    }

    // Check for resource-scoped permission in session
    const scopedPermission = createScopedPermission(permissionToCheck, resourceType, resourceId);
    return sessionPermissions.includes(scopedPermission);
}

/**
 * Client-side function to get permitted resource IDs from session permissions only.
 */
function getPermittedResourceIdsFromSession({
    sessionPermissions,
    orgPermissions,
    permissionToCheck,
    resourceType
}: {
    sessionPermissions: string[];
    orgPermissions: AuthZPermission[];
    permissionToCheck: AuthZPermission;
    resourceType: ResourceType;
}): { type: "all" } | { type: "specific"; resourceIds: string[] } {
    // Check org-level permission first
    if (hasPermission(orgPermissions, permissionToCheck)) {
        return { type: "all" };
    }

    // Collect specific resource IDs from scoped permissions
    const resourceIds: string[] = [];
    for (const perm of sessionPermissions) {
        const parsed = parseScopedPermission(perm);
        if (parsed && parsed.permission === permissionToCheck && parsed.resourceType === resourceType) {
            resourceIds.push(parsed.resourceId);
        }
    }

    return { type: "specific", resourceIds };
}

export function useAuthZ(orgName: string | undefined) {
    return convertQueryResultToLoadable(
        useQuery<UseAuthZResult>({
            queryKey: ["authz-permissions", orgName],
            queryFn: async () => {
                if (!orgName) {
                    throw new Error("orgName is required");
                }
                const response = await DashboardApiClient.getAuthZPermissions(orgName);
                const sessionPermissions = response.permissions;
                const permissions = getPermissionsFromSession({ sessionPermissions });
                return {
                    userId: response.userId,
                    orgName: response.orgName,
                    isFineGrainedPermissionsEnabled: response.isFineGrainedPermissionsEnabled,
                    isEnforcePermissions: response.isEnforcePermissions,
                    sessionPermissions,
                    permissions,
                    has: (permission: AuthZPermission) => hasPermission(permissions, permission),
                    hasResource: (permission: AuthZPermission, resourceType: ResourceType, resourceId: string) =>
                        hasResourcePermissionFromSession({
                            sessionPermissions,
                            orgPermissions: permissions,
                            permissionToCheck: permission,
                            resourceType,
                            resourceId
                        }),
                    getPermittedResources: (permission: AuthZPermission, resourceType: ResourceType) =>
                        getPermittedResourceIdsFromSession({
                            sessionPermissions,
                            orgPermissions: permissions,
                            permissionToCheck: permission,
                            resourceType
                        })
                };
            },
            enabled: !!orgName,
            staleTime: 5 * 60 * 1000
        })
    );
}
