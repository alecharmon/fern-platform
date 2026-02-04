import type { Database } from "@fern-platform/supabase";
import { errAsync, okAsync, ResultAsync } from "neverthrow";
import { getManagementClient, getManagementClientResult } from "./client";
import { auth0Error, supabaseError, type UserPermissionsError } from "./errors";
import {
    addUserRoleForResourceResult,
    getClientResult,
    removeAllUserRolesForResourceResult
} from "./resource-permissions";
import { addRolesResult, type Roles, removeRolesResult } from "./roles";

// =============================================================================
// Types
// =============================================================================

export type OidcMappingType = "org_role" | "resource_role";
export type OidcRole = "admin" | "editor" | "viewer";

/**
 * OIDC group to role mapping stored in Supabase.
 */
export interface OidcGroupMapping {
    id: string;
    orgId: string;
    connectionName: string;
    groupId: string;
    mappingType: OidcMappingType;
    role: OidcRole;
    resourceType: string | null;
    resourceId: string | null;
    createdAt: string;
    updatedAt: string;
    createdBy: string | null;
}

/**
 * Input for creating an OIDC group mapping.
 */
export interface CreateOidcGroupMappingInput {
    orgId: string;
    connectionName: string;
    groupId: string;
    mappingType: OidcMappingType;
    role: OidcRole;
    resourceType?: string;
    resourceId?: string;
    createdBy?: string;
}

/**
 * Result of syncing OIDC permissions.
 */
export type SyncResult =
    | { synced: false; reason: "no_oidc_groups" | "no_mappings" | "error" }
    | { synced: true; changes: { added: string[]; removed: string[] } };

// =============================================================================
// Auth0 App Metadata
// =============================================================================

/**
 * Fetch OIDC groups from a user's Auth0 app_metadata.
 * Returns null if no oidc-groups field exists.
 */
export async function getOidcGroups(userId: string): Promise<string[] | null> {
    const client = getManagementClient();
    const { data: user } = await client.users.get({ id: userId });

    const oidcGroups = user.app_metadata?.["oidc-groups"];
    if (!Array.isArray(oidcGroups)) {
        return null;
    }

    return oidcGroups.filter((g): g is string => typeof g === "string");
}

/**
 * Fetch OIDC groups from a user's Auth0 app_metadata, returning ResultAsync.
 */
export function getOidcGroupsResult(userId: string): ResultAsync<string[] | null, UserPermissionsError> {
    const clientResult = getManagementClientResult();
    if (clientResult.isErr()) {
        return errAsync(clientResult.error);
    }

    const client = clientResult.value;
    return ResultAsync.fromPromise(client.users.get({ id: userId }), (error) =>
        auth0Error("API_FAILED", `Failed to get user: ${error instanceof Error ? error.message : "Unknown error"}`)
    ).map(({ data: user }) => {
        const oidcGroups = user.groups;
        if (!Array.isArray(oidcGroups)) {
            return null;
        }
        return oidcGroups.filter((g): g is string => typeof g === "string");
    });
}

// =============================================================================
// Helpers
// =============================================================================

type OidcGroupMappingRow = Database["public"]["Tables"]["OidcGroupMappings"]["Row"];

function rowToMapping(row: OidcGroupMappingRow): OidcGroupMapping {
    return {
        id: row.id,
        orgId: row.org_id,
        connectionName: row.connection_name,
        groupId: row.group_id,
        mappingType: row.mapping_type as OidcMappingType,
        role: row.role as OidcRole,
        resourceType: row.resource_type,
        resourceId: row.resource_id,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        createdBy: row.created_by
    };
}

// =============================================================================
// Supabase CRUD
// =============================================================================

/**
 * Get OIDC group mappings for specific groups in an org/connection.
 */
export async function getOidcGroupMappings(
    orgId: string,
    connectionName: string,
    groupIds: string[]
): Promise<OidcGroupMapping[]> {
    if (groupIds.length === 0) {
        return [];
    }

    const clientResult = getClientResult();
    if (clientResult.isErr()) {
        throw new Error(clientResult.error.message);
    }

    const client = clientResult.value;
    const { data, error } = await client
        .from("OidcGroupMappings")
        .select("*")
        .eq("org_id", orgId)
        .eq("connection_name", connectionName)
        .in("group_id", groupIds);

    if (error) {
        throw new Error(`Failed to get OIDC group mappings: ${error.message}`);
    }

    return (data ?? []).map(rowToMapping);
}

/**
 * Get OIDC group mappings, returning ResultAsync.
 */
export function getOidcGroupMappingsResult(
    orgId: string,
    connectionName: string,
    groupIds: string[]
): ResultAsync<OidcGroupMapping[], UserPermissionsError> {
    if (groupIds.length === 0) {
        return ResultAsync.fromSafePromise(Promise.resolve([]));
    }

    const clientResult = getClientResult();
    if (clientResult.isErr()) {
        return errAsync(clientResult.error);
    }

    const client = clientResult.value;
    return ResultAsync.fromPromise(
        client
            .from("OidcGroupMappings")
            .select("*")
            .eq("org_id", orgId)
            .eq("connection_name", connectionName)
            .in("group_id", groupIds),
        () => supabaseError("QUERY_FAILED", "Failed to get OIDC group mappings")
    ).andThen(({ data, error }) => {
        if (error) {
            return errAsync(supabaseError("QUERY_FAILED", `Failed to get OIDC group mappings: ${error.message}`));
        }
        return ResultAsync.fromSafePromise(Promise.resolve((data ?? []).map(rowToMapping)));
    });
}

/**
 * List all OIDC group mappings for an org.
 */
export async function listOidcGroupMappings(orgId: string): Promise<OidcGroupMapping[]> {
    const clientResult = getClientResult();
    if (clientResult.isErr()) {
        throw new Error(clientResult.error.message);
    }

    const client = clientResult.value;
    const { data, error } = await client
        .from("OidcGroupMappings")
        .select("*")
        .eq("org_id", orgId)
        .order("created_at", { ascending: false });

    if (error) {
        throw new Error(`Failed to list OIDC group mappings: ${error.message}`);
    }

    return (data ?? []).map(rowToMapping);
}

/**
 * Create an OIDC group mapping.
 */
export async function createOidcGroupMapping(input: CreateOidcGroupMappingInput): Promise<OidcGroupMapping> {
    const clientResult = getClientResult();
    if (clientResult.isErr()) {
        throw new Error(clientResult.error.message);
    }

    const client = clientResult.value;
    const { data, error } = await client
        .from("OidcGroupMappings")
        .insert({
            org_id: input.orgId,
            connection_name: input.connectionName,
            group_id: input.groupId,
            mapping_type: input.mappingType,
            role: input.role,
            resource_type: input.resourceType ?? null,
            resource_id: input.resourceId ?? null,
            created_by: input.createdBy ?? null
        })
        .select()
        .single();

    if (error) {
        throw new Error(`Failed to create OIDC group mapping: ${error.message}`);
    }

    return rowToMapping(data);
}

/**
 * Delete an OIDC group mapping by ID.
 */
export async function deleteOidcGroupMapping(id: string): Promise<void> {
    const clientResult = getClientResult();
    if (clientResult.isErr()) {
        throw new Error(clientResult.error.message);
    }

    const client = clientResult.value;
    const { error } = await client.from("OidcGroupMappings").delete().eq("id", id);

    if (error) {
        throw new Error(`Failed to delete OIDC group mapping: ${error.message}`);
    }
}

// =============================================================================
// Permission Sync
// =============================================================================

/**
 * Role priority for "highest privilege wins" logic.
 * Higher number = higher privilege.
 */
const ROLE_PRIORITY: Record<OidcRole, number> = {
    viewer: 1,
    editor: 2,
    admin: 3
};

/**
 * Input for syncing OIDC permissions.
 */
export interface SyncOidcPermissionsInput {
    userId: string;
    orgId: string;
    connectionName: string;
}

/**
 * Sync OIDC permissions for a user based on their IdP groups.
 *
 * This function:
 * 1. Fetches the user's OIDC groups from Auth0 app_metadata
 * 2. Fetches the relevant group mappings from Supabase
 * 3. Applies the highest-privilege role from org-level mappings
 * 4. Applies the highest-privilege role for each resource from resource-level mappings
 * 5. Removes any existing permissions not covered by current mappings
 *
 * Returns a SyncResult indicating what changed.
 */
export function syncOidcPermissionsResult(
    input: SyncOidcPermissionsInput
): ResultAsync<SyncResult, UserPermissionsError> {
    const { userId, orgId, connectionName } = input;

    // Step 1: Get user's OIDC groups from Auth0
    return getOidcGroupsResult(userId).andThen((oidcGroups) => {
        if (oidcGroups === null || oidcGroups.length === 0) {
            return okAsync<SyncResult, UserPermissionsError>({
                synced: false,
                reason: "no_oidc_groups"
            });
        }

        // Step 2: Get mappings for the user's groups
        return getOidcGroupMappingsResult(orgId, connectionName, oidcGroups).andThen((mappings) => {
            if (mappings.length === 0) {
                return okAsync<SyncResult, UserPermissionsError>({
                    synced: false,
                    reason: "no_mappings"
                });
            }

            // Step 3: Separate org-level and resource-level mappings
            const orgMappings = mappings.filter((m) => m.mappingType === "org_role");
            const resourceMappings = mappings.filter((m) => m.mappingType === "resource_role");

            // Step 4: Calculate highest-privilege org role
            const targetOrgRole = getHighestPrivilegeRole(orgMappings.map((m) => m.role));

            // Step 5: Calculate highest-privilege role per resource
            const resourceRoleMap = new Map<string, OidcRole>();
            for (const mapping of resourceMappings) {
                if (mapping.resourceType && mapping.resourceId) {
                    const key = `${mapping.resourceType}:${mapping.resourceId}`;
                    const existingRole = resourceRoleMap.get(key);
                    if (!existingRole || ROLE_PRIORITY[mapping.role] > ROLE_PRIORITY[existingRole]) {
                        resourceRoleMap.set(key, mapping.role);
                    }
                }
            }

            // Step 6: Apply permissions
            return applyOidcPermissions({
                userId,
                orgId,
                targetOrgRole,
                resourceRoleMap,
                resourceMappings
            });
        });
    });
}

/**
 * Get the highest-privilege role from a list of roles.
 */
function getHighestPrivilegeRole(roles: OidcRole[]): OidcRole | null {
    if (roles.length === 0) {
        return null;
    }

    return roles.reduce((highest, current) => {
        return ROLE_PRIORITY[current] > ROLE_PRIORITY[highest] ? current : highest;
    });
}

/**
 * Apply OIDC-derived permissions to a user.
 */
function applyOidcPermissions({
    userId,
    orgId,
    targetOrgRole,
    resourceRoleMap,
    resourceMappings
}: {
    userId: string;
    orgId: string;
    targetOrgRole: OidcRole | null;
    resourceRoleMap: Map<string, OidcRole>;
    resourceMappings: OidcGroupMapping[];
}): ResultAsync<SyncResult, UserPermissionsError> {
    const added: string[] = [];
    const removed: string[] = [];

    // Apply org-level role
    const orgRoleResult = targetOrgRole
        ? applyOrgRole(userId, orgId, targetOrgRole, added, removed)
        : removeAllOrgRoles(userId, orgId, removed);

    return orgRoleResult
        .andThen(() => {
            // Apply resource-level roles
            return applyResourceRoles(userId, orgId, resourceRoleMap, resourceMappings, added, removed);
        })
        .map(() => ({
            synced: true as const,
            changes: { added, removed }
        }));
}

/**
 * Apply org-level role to user.
 */
function applyOrgRole(
    userId: string,
    orgId: string,
    targetRole: OidcRole,
    added: string[],
    removed: string[]
): ResultAsync<void, UserPermissionsError> {
    const allOrgRoles: Roles[] = ["admin", "editor", "viewer"];
    const rolesToRemove = allOrgRoles.filter((r) => r !== targetRole);

    // Remove non-target roles first, then add target role
    return removeRolesResult({ userId, orgId, roleNames: rolesToRemove })
        .map(() => {
            for (const role of rolesToRemove) {
                removed.push(`org:${role}`);
            }
        })
        .andThen(() =>
            addRolesResult({ userId, orgId, roleNames: [targetRole as Roles] }).map(() => {
                added.push(`org:${targetRole}`);
            })
        );
}

/**
 * Remove all org-level roles from user.
 */
function removeAllOrgRoles(userId: string, orgId: string, removed: string[]): ResultAsync<void, UserPermissionsError> {
    const allOrgRoles: Roles[] = ["admin", "editor", "viewer"];
    return removeRolesResult({ userId, orgId, roleNames: allOrgRoles }).map(() => {
        for (const role of allOrgRoles) {
            removed.push(`org:${role}`);
        }
    });
}

/**
 * Apply resource-level roles to user.
 */
function applyResourceRoles(
    userId: string,
    orgId: string,
    resourceRoleMap: Map<string, OidcRole>,
    resourceMappings: OidcGroupMapping[],
    added: string[],
    removed: string[]
): ResultAsync<void, UserPermissionsError> {
    // Get unique resources from mappings
    const resources = new Set<string>();
    for (const mapping of resourceMappings) {
        if (mapping.resourceType && mapping.resourceId) {
            resources.add(`${mapping.resourceType}:${mapping.resourceId}`);
        }
    }

    // Process each resource
    const operations: ResultAsync<void, UserPermissionsError>[] = [];
    for (const resourceKey of resources) {
        const [resourceType, resourceId] = resourceKey.split(":");
        if (!resourceType || !resourceId) {
            continue;
        }

        const targetRole = resourceRoleMap.get(resourceKey);
        if (targetRole) {
            // Remove existing roles for this resource, then add new one
            operations.push(
                removeAllUserRolesForResourceResult({
                    orgId,
                    userId,
                    resourceType,
                    resourceId
                })
                    .map(() => {
                        removed.push(`${resourceKey}:*`);
                    })
                    .andThen(() =>
                        addUserRoleForResourceResult({
                            org_id: orgId,
                            user_id: userId,
                            resource_type: resourceType,
                            resource_id: resourceId,
                            role: targetRole as Roles
                        }).map(() => {
                            added.push(`${resourceKey}:${targetRole}`);
                        })
                    )
            );
        }
    }

    // Run all operations (they're independent)
    if (operations.length === 0) {
        return okAsync(undefined);
    }

    return ResultAsync.combine(operations).map(() => undefined);
}

/**
 * Sync OIDC permissions (throwing version).
 */
export async function syncOidcPermissions(input: SyncOidcPermissionsInput): Promise<SyncResult> {
    const result = await syncOidcPermissionsResult(input);
    if (result.isErr()) {
        throw new Error(result.error.message);
    }
    return result.value;
}
