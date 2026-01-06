import {
    FINE_GRAIN_PERMISSION,
    getAllRolePermissions,
    getRolePermissions,
    getUserAccessibleResources,
    getUserPermissionsForResource,
    getUserRoles,
    getUserRolesForResource,
    hasFineGrainPermission,
    hasUserPermissionForResource
} from "./resource-permissions";

export const AUTHZ_PERMISSIONS = ["view", "edit", "manage-users", "manage-settings", "cli", "super-user"] as const;

export type AuthZPermission = (typeof AUTHZ_PERMISSIONS)[number];

const AUTHZ_PERMISSION_SET = new Set<AuthZPermission>(AUTHZ_PERMISSIONS);

export function isAuthZPermission(value: unknown): value is AuthZPermission {
    return typeof value === "string" && AUTHZ_PERMISSION_SET.has(value as AuthZPermission);
}

export function hasPermission(permissions: AuthZPermission[], permissionToCheck: AuthZPermission): boolean {
    const isSuperUser = permissions.includes("super-user");
    return isSuperUser || permissions.includes(permissionToCheck);
}

/**
 * Resource types that can have scoped permissions.
 */
export const RESOURCE_TYPES = ["docs"] as const;
export type ResourceType = (typeof RESOURCE_TYPES)[number];

/**
 * A scoped permission string in the format: `permission:resourceType:resourceId`
 * Example: `view:docs:my-doc-site-id`
 */
export type ScopedPermissionString = `${AuthZPermission}:${ResourceType}:${string}`;

/**
 * Parsed representation of a scoped permission.
 */
export interface ScopedPermission {
    permission: AuthZPermission;
    resourceType: ResourceType;
    resourceId: string;
}

/**
 * Parses a scoped permission string into its components.
 * Returns undefined if the string is not a valid scoped permission.
 */
export function parseScopedPermission(value: string): ScopedPermission | undefined {
    const parts = value.split(":");
    if (parts.length !== 3) {
        return undefined;
    }
    const [permission, resourceType, resourceId] = parts;
    if (!isAuthZPermission(permission)) {
        return undefined;
    }
    if (!RESOURCE_TYPES.includes(resourceType as ResourceType)) {
        return undefined;
    }
    if (!resourceId || resourceId.length === 0) {
        return undefined;
    }
    return {
        permission: permission as AuthZPermission,
        resourceType: resourceType as ResourceType,
        resourceId
    };
}

/**
 * Creates a scoped permission string from its components.
 */
export function createScopedPermission(
    permission: AuthZPermission,
    resourceType: ResourceType,
    resourceId: string
): ScopedPermissionString {
    return `${permission}:${resourceType}:${resourceId}`;
}

/**
 * Extracts and validates AuthZPermissions from a session's raw permissions array.
 * Filters out any invalid permissions and returns only valid AuthZPermission values.
 */
export function getPermissionsFromSession({
    sessionPermissions
}: {
    sessionPermissions: string[] | undefined;
}): AuthZPermission[] {
    if (!sessionPermissions) {
        return [];
    }
    return sessionPermissions.filter(isAuthZPermission);
}

/**
 * Checks if a user has a specific permission for a given resource.
 *
 * Permission checking order:
 * 1. super-user grants access to everything
 * 2. Org-level permission (e.g., "view") grants access to all resources
 * 3. If fine-grained permissions enabled, check Supabase for resource-level permissions
 * 4. Otherwise, check session for resource-scoped permission string
 *
 * @param sessionPermissions - Raw permission strings from the session
 * @param userId - The user ID (required for Supabase lookup when fine-grained is enabled)
 * @param orgId - The organization ID (required for Supabase lookup when fine-grained is enabled)
 * @param permissionToCheck - The permission type to check (e.g., "view", "edit")
 * @param resourceType - The type of resource being accessed
 * @param resourceId - The specific resource ID being accessed
 * @param forceFineGrained - Optional override to force fine-grained permission check (e.g., from feature flag)
 */
export async function hasResourcePermission({
    sessionPermissions,
    userId,
    orgId,
    permissionToCheck,
    resourceType,
    resourceId,
    forceFineGrained
}: {
    sessionPermissions: string[];
    userId: string;
    orgId: string;
    permissionToCheck: AuthZPermission;
    resourceType: ResourceType;
    resourceId: string;
    forceFineGrained?: boolean;
}): Promise<boolean> {
    // Extract org-level permissions from session
    const orgPermissions = getPermissionsFromSession({ sessionPermissions });

    // Check org-level permission first (cascades to all resources)
    if (hasPermission(orgPermissions, permissionToCheck)) {
        return true;
    }

    // Check if fine-grained permissions are enabled (via override or session marker)
    const isFineGrainedEnabled = forceFineGrained ?? hasFineGrainPermission(sessionPermissions);

    if (isFineGrainedEnabled) {
        // Check Supabase for resource-level permissions
        return hasUserPermissionForResource({
            userId,
            orgId,
            resourceType,
            resourceId,
            permission: permissionToCheck
        });
    }

    // Fall back to checking session for resource-scoped permission string
    const scopedPermission = createScopedPermission(permissionToCheck, resourceType, resourceId);
    return sessionPermissions.includes(scopedPermission);
}

/**
 * Builds the complete list of permission strings for a user, including both
 * org-level permissions and resource-scoped permissions from Supabase.
 *
 * This is useful for building a comprehensive permissions list to send to the client.
 *
 * @param sessionPermissions - Raw permission strings from the session (org-level)
 * @param userId - The user ID for Supabase lookup
 * @param orgId - The organization ID for Supabase lookup
 * @param forceFineGrained - Optional override to force fine-grained permission fetch (e.g., from feature flag)
 * @returns Array of permission strings including scoped permissions in format `permission:resourceType:resourceId`
 */
export async function getAllUserScopedPermissions({
    sessionPermissions,
    userId,
    orgId,
    forceFineGrained
}: {
    sessionPermissions: string[];
    userId: string;
    orgId: string;
    forceFineGrained?: boolean;
}): Promise<string[]> {
    // Start with session permissions (org-level)
    const permissions: string[] = [...sessionPermissions];

    // Check if fine-grained permissions are enabled
    const isFineGrainedEnabled = forceFineGrained ?? hasFineGrainPermission(sessionPermissions);

    if (isFineGrainedEnabled) {
        try {
            // Get all resource roles for the user
            const resourceRoles = await getUserRoles({ orgId, userId });

            // Convert each role to its permissions and create scoped permission strings
            for (const roleAssignment of resourceRoles) {
                const rolePermissions = await getRolePermissions(roleAssignment.role);
                for (const permission of rolePermissions) {
                    if (isAuthZPermission(permission)) {
                        const scopedPermission = createScopedPermission(
                            permission,
                            roleAssignment.resource_type as ResourceType,
                            roleAssignment.resource_id
                        );
                        if (!permissions.includes(scopedPermission)) {
                            permissions.push(scopedPermission);
                        }
                    }
                }
            }
        } catch (error) {
            // Log error but fall back to session permissions only
            // biome-ignore lint/suspicious/noConsole: logging error for debugging
            console.error("[getAllUserScopedPermissions] Failed to fetch fine-grained permissions:", error);
        }
    }

    return permissions;
}

/**
 * Extracts all resource IDs that a user has a specific permission for.
 *
 * @param sessionPermissions - Raw permission strings from the session
 * @param userId - The user ID (required for Supabase lookup when fine-grained is enabled)
 * @param orgId - The organization ID (required for Supabase lookup when fine-grained is enabled)
 * @param permissionToCheck - The permission type to filter by
 * @param resourceType - The resource type to filter by
 * @returns { type: "all" } if user has org-level permission, or { type: "specific", resourceIds: [...] }
 */
export async function getPermittedResourceIds({
    sessionPermissions,
    userId,
    orgId,
    permissionToCheck,
    resourceType
}: {
    sessionPermissions: string[];
    userId: string;
    orgId: string;
    permissionToCheck: AuthZPermission;
    resourceType: ResourceType;
}): Promise<{ type: "all" } | { type: "specific"; resourceIds: string[] }> {
    // Extract org-level permissions and check with cascading
    const orgPermissions = getPermissionsFromSession({ sessionPermissions });
    if (hasPermission(orgPermissions, permissionToCheck)) {
        return { type: "all" };
    }

    // Check if fine-grained permissions are enabled
    if (hasFineGrainPermission(sessionPermissions)) {
        // Get all resources the user has any role on
        const accessibleResourceIds = await getUserAccessibleResources({ userId, resourceType });

        // Get role-permission mappings to filter by the specific permission
        const allRolePermissions = await getAllRolePermissions();
        const rolesWithPermission = new Set(
            allRolePermissions.filter((rp) => rp.permission === permissionToCheck).map((rp) => rp.role)
        );

        // Filter to only resources where user has a role that grants the permission
        const permittedResourceIds: string[] = [];

        for (const resourceId of accessibleResourceIds) {
            const userRoles = await getUserRolesForResource({ orgId, userId, resourceType, resourceId });
            const hasMatchingRole = userRoles.some((ur) => rolesWithPermission.has(ur.role));
            if (hasMatchingRole) {
                permittedResourceIds.push(resourceId);
            }
        }

        return { type: "specific", resourceIds: permittedResourceIds };
    }

    // Fall back to parsing scoped permissions from session
    const resourceIds: string[] = [];
    for (const perm of sessionPermissions) {
        const parsed = parseScopedPermission(perm);
        if (parsed && parsed.permission === permissionToCheck && parsed.resourceType === resourceType) {
            resourceIds.push(parsed.resourceId);
        }
    }

    return { type: "specific", resourceIds };
}

/**
 * Gets all permissions a user has for a specific resource.
 *
 * @param sessionPermissions - Raw permission strings from the session
 * @param userId - The user ID (required for Supabase lookup when fine-grained is enabled)
 * @param orgId - The organization ID (required for Supabase lookup when fine-grained is enabled)
 * @param resourceType - The type of resource
 * @param resourceId - The specific resource ID
 */
export async function getResourcePermissions({
    sessionPermissions,
    userId,
    orgId,
    resourceType,
    resourceId
}: {
    sessionPermissions: string[];
    userId: string;
    orgId: string;
    resourceType: ResourceType;
    resourceId: string;
}): Promise<AuthZPermission[]> {
    // Extract org-level permissions from session
    const orgPermissions = getPermissionsFromSession({ sessionPermissions });

    // If user has super-user, they have all permissions
    if (hasPermission(orgPermissions, "super-user")) {
        return [...AUTHZ_PERMISSIONS];
    }

    // Check if fine-grained permissions are enabled
    if (hasFineGrainPermission(sessionPermissions)) {
        // Get permissions from Supabase
        const permissions = await getUserPermissionsForResource({
            userId,
            orgId,
            resourceType,
            resourceId
        });
        // Filter to only valid AuthZ permissions and combine with org-level
        const resourcePerms = permissions.filter(isAuthZPermission);
        return [...new Set([...orgPermissions, ...resourcePerms])];
    }

    // Fall back to parsing scoped permissions from session
    const resourcePerms: AuthZPermission[] = [];
    for (const perm of sessionPermissions) {
        const parsed = parseScopedPermission(perm);
        if (parsed && parsed.resourceType === resourceType && parsed.resourceId === resourceId) {
            resourcePerms.push(parsed.permission);
        }
    }

    return [...new Set([...orgPermissions, ...resourcePerms])];
}

/**
 * Route permission configuration for middleware authorization.
 * Can be org-level (no resource scope) or resource-scoped.
 */
export interface RoutePermissionConfig {
    pattern: RegExp;
    requiredPermission: AuthZPermission;
    /**
     * Optional resource scope for fine-grained access control.
     * When provided, the route check will use resource-scoped permissions.
     */
    resourceScope?: {
        resourceType: ResourceType;
        /**
         * Index of the capture group in the pattern regex that contains the resource ID.
         * For example, if pattern is /^\/docs\/([^/]+)\/edit/, captureGroup: 1 extracts the doc site ID.
         */
        captureGroup: number;
    };
}

export interface RoutePermissionResult {
    allowed: boolean;
    requiredPermission?: AuthZPermission;
    resourceId?: string;
}

/**
 * Checks if a user has permission to access a given route based on route permission configurations.
 * Supports both org-level and resource-scoped permission checks.
 *
 * @param pathname - The route pathname to check
 * @param sessionPermissions - Raw permission strings from session (supports both org-level and scoped)
 * @param userId - The user ID (required for Supabase lookup when fine-grained is enabled)
 * @param orgId - The organization ID (required for Supabase lookup when fine-grained is enabled)
 * @param routeConfigs - Array of route permission configurations
 * @returns Object with allowed status, required permission, and optionally the resource ID
 */
export async function hasRoutePermission({
    pathname,
    sessionPermissions,
    userId,
    orgId,
    routeConfigs
}: {
    pathname: string;
    sessionPermissions: string[];
    userId: string;
    orgId: string;
    routeConfigs: RoutePermissionConfig[];
}): Promise<RoutePermissionResult> {
    for (const config of routeConfigs) {
        const match = config.pattern.exec(pathname);
        if (match) {
            // Check if this route requires resource-scoped permission
            if (config.resourceScope) {
                const resourceId = match[config.resourceScope.captureGroup];
                if (!resourceId) {
                    return {
                        allowed: false,
                        requiredPermission: config.requiredPermission
                    };
                }

                const allowed = await hasResourcePermission({
                    sessionPermissions,
                    userId,
                    orgId,
                    permissionToCheck: config.requiredPermission,
                    resourceType: config.resourceScope.resourceType,
                    resourceId
                });

                return {
                    allowed,
                    requiredPermission: config.requiredPermission,
                    resourceId
                };
            }

            // Org-level permission check
            const orgPermissions = getPermissionsFromSession({ sessionPermissions });
            const allowed = hasPermission(orgPermissions, config.requiredPermission);
            return { allowed, requiredPermission: config.requiredPermission };
        }
    }
    return { allowed: true };
}

// Re-export fine-grained permission utilities
export { FINE_GRAIN_PERMISSION, hasFineGrainPermission };
