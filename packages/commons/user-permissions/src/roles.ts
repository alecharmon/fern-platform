import type { ApiResponse, GetOrganizationMemberRoles200ResponseOneOfInner, ManagementClient } from "auth0";
import { err, errAsync, ok, type Result, ResultAsync } from "neverthrow";

import { getManagementClient, getManagementClientResult } from "./client";
import { auth0Error, type UserPermissionsError } from "./errors";
import { AUTHZ_PERMISSIONS, type AuthZPermission } from "./permissions";

export type Roles = "admin" | "editor" | "viewer" | "cli" | "fine_grain";

type RoleMap = {
    admin: string;
    editor: string;
    viewer: string;
    cli: string;
    fine_grain: string;
};

/**
 * Default permissions granted to each role.
 * Used as a fallback when the token doesn't yet have permissions
 * (e.g., the token hasn't been invalidated after a role assignment).
 */
export const DEFAULT_ROLE_PERMISSIONS: Record<Roles, AuthZPermission[]> = {
    admin: [...AUTHZ_PERMISSIONS],
    editor: ["edit", "view"],
    viewer: ["view"],
    cli: ["cli"],
    fine_grain: []
};

/**
 * Org-level roles that grant broad permissions.
 * When a user is assigned one of these roles, the fine_grain role should be removed
 * since org-level permissions supersede resource-scoped permissions.
 */
const ORG_LEVEL_ROLES: readonly Roles[] = ["admin", "editor", "viewer"] as const;

function isOrgLevelRole(role: Roles): boolean {
    return ORG_LEVEL_ROLES.includes(role);
}

export function parseAuth0RoleIdsFromEnvVar(envVarValue: string | undefined = process.env.AUTH0_ROLES): RoleMap {
    if (envVarValue == null) {
        throw new Error("AUTH0_ROLES environment variable is not defined.");
    }
    try {
        const parsed = JSON.parse(envVarValue);
        return parsed as RoleMap;
    } catch (error) {
        throw new Error(
            "Failed to parse AUTH0_ROLES environment variable.",
            error instanceof Error ? { cause: error } : undefined
        );
    }
}

// Lazy-loaded singleton for ROLES to ensure env vars are available
let _ROLES: RoleMap | undefined;

export function getRoleMapping(): RoleMap {
    if (_ROLES == null) {
        _ROLES = parseAuth0RoleIdsFromEnvVar();
    }
    return _ROLES;
}

/**
 * Get the role mapping, returning Result instead of throwing.
 */
export function getRoleMappingResult(): Result<RoleMap, UserPermissionsError> {
    if (_ROLES != null) {
        return ok(_ROLES);
    }
    const envVarValue = process.env.AUTH0_ROLES;
    if (envVarValue == null) {
        return err(auth0Error("ROLE_MAPPING_INVALID", "AUTH0_ROLES environment variable is not defined."));
    }
    try {
        const parsed = JSON.parse(envVarValue);
        _ROLES = parsed as RoleMap;
        return ok(_ROLES);
    } catch (error) {
        return err(
            auth0Error(
                "ROLE_MAPPING_INVALID",
                `Failed to parse AUTH0_ROLES environment variable: ${error instanceof Error ? error.message : "Unknown error"}`
            )
        );
    }
}

export interface UserPermissionsResponse extends ApiResponse<void> {
    ok: boolean;
}

function mapToUserPermissionsResponse(response: ApiResponse<void>): UserPermissionsResponse {
    return {
        ...response,
        ok: response.status >= 200 && response.status < 300
    };
}

/**
 * Invalidates all sessions and refresh tokens for a user.
 * This forces the user to re-authenticate and get new tokens with updated permissions.
 */
async function invalidateUserSessions(client: ManagementClient, userId: string): Promise<void> {
    try {
        // Delete all sessions to force immediate re-login
        await client.users.deleteSessions({ user_id: userId });
    } catch (error) {
        // biome-ignore lint/suspicious/noConsole: logging error for debugging session invalidation failures
        console.error(`Failed to invalidate sessions for user ${userId}:`, error);
    }

    try {
        // Also revoke refresh tokens for completeness
        await client.users.deleteRefreshTokens({ user_id: userId });
    } catch (error) {
        // biome-ignore lint/suspicious/noConsole: logging error for debugging token revocation failures
        console.error(`Failed to revoke refresh tokens for user ${userId}:`, error);
    }
}

export interface GetUserRolesResponse extends ApiResponse<Roles[]> {
    ok: boolean;
}

function mapToGetUserRolesResponse(response: ApiResponse<Array<GetOrganizationMemberRoles200ResponseOneOfInner>>) {
    return {
        ...response,
        data: response.data
            .map((r) => r.name)
            .filter((role): role is Roles => Object.keys(getRoleMapping()).includes(role as Roles)),
        ok: response.status >= 200 && response.status < 300
    };
}

export interface UpdateRolesRequest {
    client?: ManagementClient;
    userId: string;
    orgId: string;
    roleNames: Roles[];
}

export async function addRoles({
    client,
    orgId,
    userId,
    roleNames
}: UpdateRolesRequest): Promise<UserPermissionsResponse> {
    const managementClient = client ?? getManagementClient();
    const result = await managementClient.organizations.addMemberRoles(
        { user_id: userId, id: orgId },
        { roles: roleNames.map((roleName) => getRoleMapping()[roleName].toString()) }
    );

    // If adding an org-level role, remove fine_grain role since org-level permissions
    // supersede resource-scoped permissions
    const isAddingOrgLevelRole = roleNames.some(isOrgLevelRole);
    if (isAddingOrgLevelRole) {
        const fineGrainRoleId = getRoleMapping().fine_grain;
        if (fineGrainRoleId) {
            try {
                await managementClient.organizations.deleteMemberRoles(
                    { user_id: userId, id: orgId },
                    { roles: [fineGrainRoleId.toString()] }
                );
            } catch {
                // fine_grain role may not exist on user, ignore errors
            }
        }
    }

    // Invalidate sessions to force re-authentication with updated permissions
    await invalidateUserSessions(managementClient, userId);

    return mapToUserPermissionsResponse(result);
}

export async function removeRoles({
    client,
    orgId,
    userId,
    roleNames
}: UpdateRolesRequest): Promise<UserPermissionsResponse> {
    const managementClient = client ?? getManagementClient();
    const result = await managementClient.organizations.deleteMemberRoles(
        { user_id: userId, id: orgId },
        { roles: roleNames.map((roleName) => getRoleMapping()[roleName].toString()) }
    );

    // Invalidate sessions to force re-authentication with updated permissions
    await invalidateUserSessions(managementClient, userId);

    return mapToUserPermissionsResponse(result);
}

export interface GetRolesRequest {
    client?: ManagementClient;
    userId: string;
    orgId: string;
}

export async function getRoles({ client, orgId, userId }: GetRolesRequest): Promise<GetUserRolesResponse> {
    const managementClient = client ?? getManagementClient();
    const result = await managementClient.organizations.getMemberRoles({ user_id: userId, id: orgId });

    return mapToGetUserRolesResponse(result);
}

/**
 * Invalidates all sessions and refresh tokens for a user without throwing.
 * This forces the user to re-authenticate and get new tokens with updated permissions.
 */
async function invalidateUserSessionsAsync(client: ManagementClient, userId: string): Promise<void> {
    try {
        await client.users.deleteSessions({ user_id: userId });
    } catch {
        // Ignore session deletion errors
    }
    try {
        await client.users.deleteRefreshTokens({ user_id: userId });
    } catch {
        // Ignore token revocation errors
    }
}

/**
 * Add roles to a user in an organization, returning ResultAsync instead of throwing.
 */
export function addRolesResult({
    orgId,
    userId,
    roleNames
}: Omit<UpdateRolesRequest, "client">): ResultAsync<UserPermissionsResponse, UserPermissionsError> {
    const clientResult = getManagementClientResult();
    if (clientResult.isErr()) {
        return errAsync(clientResult.error);
    }
    const managementClient = clientResult.value;

    const roleMappingResult = getRoleMappingResult();
    if (roleMappingResult.isErr()) {
        return errAsync(roleMappingResult.error);
    }
    const roleMapping = roleMappingResult.value;

    return ResultAsync.fromPromise(
        (async () => {
            const result = await managementClient.organizations.addMemberRoles(
                { user_id: userId, id: orgId },
                { roles: roleNames.map((roleName) => roleMapping[roleName].toString()) }
            );

            // If adding an org-level role, remove fine_grain role since org-level permissions
            // supersede resource-scoped permissions
            const isAddingOrgLevelRole = roleNames.some(isOrgLevelRole);
            if (isAddingOrgLevelRole) {
                const fineGrainRoleId = roleMapping.fine_grain;
                if (fineGrainRoleId) {
                    try {
                        await managementClient.organizations.deleteMemberRoles(
                            { user_id: userId, id: orgId },
                            { roles: [fineGrainRoleId.toString()] }
                        );
                    } catch {
                        // fine_grain role may not exist on user, ignore errors
                    }
                }
            }

            // Invalidate sessions to force re-authentication with updated permissions
            await invalidateUserSessionsAsync(managementClient, userId);

            return mapToUserPermissionsResponse(result);
        })(),
        (error) =>
            auth0Error("API_FAILED", `Failed to add roles: ${error instanceof Error ? error.message : "Unknown error"}`)
    );
}

/**
 * Remove roles from a user in an organization, returning ResultAsync instead of throwing.
 */
export function removeRolesResult({
    orgId,
    userId,
    roleNames
}: Omit<UpdateRolesRequest, "client">): ResultAsync<UserPermissionsResponse, UserPermissionsError> {
    const clientResult = getManagementClientResult();
    if (clientResult.isErr()) {
        return errAsync(clientResult.error);
    }
    const managementClient = clientResult.value;

    const roleMappingResult = getRoleMappingResult();
    if (roleMappingResult.isErr()) {
        return errAsync(roleMappingResult.error);
    }
    const roleMapping = roleMappingResult.value;

    return ResultAsync.fromPromise(
        (async () => {
            const result = await managementClient.organizations.deleteMemberRoles(
                { user_id: userId, id: orgId },
                { roles: roleNames.map((roleName) => roleMapping[roleName].toString()) }
            );

            // Invalidate sessions to force re-authentication with updated permissions
            await invalidateUserSessionsAsync(managementClient, userId);

            return mapToUserPermissionsResponse(result);
        })(),
        (error) =>
            auth0Error(
                "API_FAILED",
                `Failed to remove roles: ${error instanceof Error ? error.message : "Unknown error"}`
            )
    );
}

/**
 * Get roles for a user in an organization, returning ResultAsync instead of throwing.
 */
export function getRolesResult({
    orgId,
    userId
}: Omit<GetRolesRequest, "client">): ResultAsync<GetUserRolesResponse, UserPermissionsError> {
    const clientResult = getManagementClientResult();
    if (clientResult.isErr()) {
        return errAsync(clientResult.error);
    }
    const managementClient = clientResult.value;

    const roleMappingResult = getRoleMappingResult();
    if (roleMappingResult.isErr()) {
        return errAsync(roleMappingResult.error);
    }
    const roleMapping = roleMappingResult.value;

    return ResultAsync.fromPromise(
        (async () => {
            const result = await managementClient.organizations.getMemberRoles({
                user_id: userId,
                id: orgId
            });

            return {
                ...result,
                data: result.data
                    .map((r) => r.name)
                    .filter((role): role is Roles => Object.keys(roleMapping).includes(role as Roles)),
                ok: result.status >= 200 && result.status < 300
            };
        })(),
        (error) =>
            auth0Error("API_FAILED", `Failed to get roles: ${error instanceof Error ? error.message : "Unknown error"}`)
    );
}

/**
 * Get default permissions for a user based on their org roles.
 * Used as a fallback when the token doesn't yet contain permissions
 * (e.g., the token hasn't been invalidated after a role assignment).
 */
export function getDefaultPermissionsForOrgUser({ orgId, userId }: Omit<GetRolesRequest, "client">): ResultAsync<
    {
        ok: boolean;
        data: AuthZPermission[];
    },
    UserPermissionsError
> {
    const roles = getRolesResult({ orgId, userId });

    return roles.map((r) => {
        const defaultPermissions = r.data.flatMap((role) => DEFAULT_ROLE_PERMISSIONS[role]);
        return {
            ...r,
            data: [...new Set(defaultPermissions)]
        };
    });
}
