// ResultAsync variants - Auth0
export { getManagementClientResult } from "./client";

// Error types
export {
    AUTH0_ERROR_CODES,
    type Auth0Error,
    type Auth0ErrorCode,
    auth0Error,
    SUPABASE_ERROR_CODES,
    type SupabaseError,
    type SupabaseErrorCode,
    supabaseError,
    type UserPermissionsError
} from "./errors";
export {
    AUTHZ_PERMISSIONS,
    type AuthZPermission,
    createScopedPermission,
    FINE_GRAIN_PERMISSION,
    getAllUserScopedPermissions,
    getPermissionsFromSession,
    getPermittedResourceIds,
    getResourcePermissions,
    hasFineGrainPermission,
    hasPermission,
    hasResourcePermission,
    hasRoutePermission,
    isAuthZPermission,
    isSuperUser,
    type PermissionLogger,
    parseScopedPermission,
    // Resource-scoped permissions
    RESOURCE_TYPES,
    type ResourceType,
    type RoutePermissionConfig,
    type RoutePermissionResult,
    type ScopedPermission,
    type ScopedPermissionString
} from "./permissions";
// Resource-level permissions (Supabase-backed, auto-initializes from env vars)
// ResultAsync variants - Supabase
export {
    addRolePermission,
    addRolePermissionResult,
    addUserRoleForResource,
    addUserRoleForResourceResult,
    getAllRolePermissions,
    getAllRolePermissionsResult,
    getClientResult,
    getResourceUsers,
    getResourceUsersResult,
    getRolePermissions,
    getRolePermissionsResult,
    getUserAccessibleResources,
    getUserAccessibleResourcesResult,
    getUserPermissionsForResource,
    getUserPermissionsForResourceResult,
    getUserRoles,
    getUserRolesForResource,
    getUserRolesForResourceResult,
    getUserRolesResult,
    hasUserPermissionForResource,
    hasUserPermissionForResourceResult,
    type ResourceRole,
    type RolePermission,
    type RolePermissionInsert,
    removeAllUserRolesForResource,
    removeAllUserRolesForResourceResult,
    removeRolePermission,
    removeRolePermissionResult,
    removeUserRoleForResource,
    removeUserRoleForResourceResult,
    type UserRolePerResource,
    type UserRolePerResourceInsert
} from "./resource-permissions";
export {
    addRoles,
    addRolesResult,
    type GetRolesRequest,
    type GetUserRolesResponse,
    getRoleMapping,
    getRoleMappingResult,
    getRoles,
    getRolesResult,
    parseAuth0RoleIdsFromEnvVar,
    type Roles,
    removeRoles,
    removeRolesResult,
    type UpdateRolesRequest,
    type UserPermissionsResponse
} from "./roles";

export { addPermission, type PermissionRequest, removePermission } from "./user-permissions";
