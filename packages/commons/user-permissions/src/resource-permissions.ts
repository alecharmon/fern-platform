import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { err, errAsync, ok, okAsync, type Result, ResultAsync } from "neverthrow";

import type { Database } from "./database.types";
import { supabaseError, type UserPermissionsError } from "./errors";
import type { Roles } from "./roles";

/**
 * Fine-grained permission discriminator.
 * When a session has this permission, resource-level permissions are checked from Supabase.
 */
export const FINE_GRAIN_PERMISSION = "app:fine_grain" as const;

/**
 * Resource-level roles that can be assigned to users.
 */
export const RESOURCE_ROLES = ["admin", "viewer", "editor"] as const;
export type ResourceRole = Roles;

/**
 * User role assignment for a specific resource.
 */
export interface UserRolePerResource {
    id: string;
    org_id: string;
    user_id: string;
    resource_type: string;
    resource_id: string;
    role: ResourceRole;
}

/**
 * Input for creating a user role assignment.
 */
export interface UserRolePerResourceInsert {
    org_id: string;
    user_id: string;
    resource_type: string;
    resource_id: string;
    role: ResourceRole;
}

/**
 * Role to permission mapping.
 */
export interface RolePermission {
    id: number;
    role: ResourceRole;
    permission: string;
}

/**
 * Input for creating a role permission mapping.
 */
export interface RolePermissionInsert {
    role: ResourceRole;
    permission: string;
}

// =============================================================================
// Supabase Client
// =============================================================================

let supabaseClient: SupabaseClient<Database> | undefined;

/**
 * Get a singleton Supabase client instance for resource permission operations.
 * Lazy loads and auto-initializes from environment variables on first use.
 *
 * Required environment variables:
 * - SUPABASE_URL
 * - SUPABASE_SERVICE_ROLE_KEY
 */
function getClient(): SupabaseClient<Database> {
    if (supabaseClient != null) {
        return supabaseClient;
    }

    const supabaseUrl = process.env.SUPABASE_URL;
    if (!supabaseUrl) {
        throw new Error("Supabase URL not configured. Set SUPABASE_URL environment variable.");
    }

    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceKey) {
        throw new Error(
            "Supabase service role key not configured. Set SUPABASE_SERVICE_ROLE_KEY environment variable."
        );
    }

    supabaseClient = createClient(supabaseUrl, serviceKey, {
        auth: {
            persistSession: false,
            autoRefreshToken: false
        }
    });
    return supabaseClient;
}

/**
 * Get a Supabase client, returning a Result instead of throwing.
 */
export function getClientResult(): Result<SupabaseClient<Database>, UserPermissionsError> {
    if (supabaseClient != null) {
        return ok(supabaseClient);
    }
    try {
        const client = getClient();
        return ok(client);
    } catch (e) {
        return err(
            supabaseError(
                "NOT_CONFIGURED",
                "Could not initialize Supabase client: " + (e instanceof Error ? e.message : String(e))
            )
        );
    }
}

// =============================================================================
// User Role Per Resource CRUD Operations
// =============================================================================

/**
 * Get all roles for a user within an org.
 */
export async function getUserRoles({
    orgId,
    userId
}: {
    orgId: string;
    userId: string;
}): Promise<UserRolePerResource[]> {
    const client = getClient();
    const { data, error } = await client
        .from("UserRolesPerResource")
        .select("*")
        .eq("org_id", orgId)
        .eq("user_id", userId);

    if (error) {
        throw new Error(`Failed to get user roles: ${error.message}`);
    }
    return (data ?? []) as UserRolePerResource[];
}

/**
 * Get all roles for a user within an org, returning ResultAsync.
 */
export function getUserRolesResult({
    orgId,
    userId
}: {
    orgId: string;
    userId: string;
}): ResultAsync<UserRolePerResource[], UserPermissionsError> {
    const clientResult = getClientResult();
    if (clientResult.isErr()) {
        return errAsync(clientResult.error);
    }

    const client = clientResult.value;
    return ResultAsync.fromPromise(
        client.from("UserRolesPerResource").select("*").eq("org_id", orgId).eq("user_id", userId),
        () => supabaseError("QUERY_FAILED", "Failed to get user roles")
    ).andThen(({ data, error }) => {
        if (error) {
            return errAsync(supabaseError("QUERY_FAILED", `Failed to get user roles: ${error.message}`));
        }
        return okAsync((data ?? []) as UserRolePerResource[]);
    });
}

/**
 * Get all roles for a user on a specific resource.
 */
export async function getUserRolesForResource({
    orgId,
    userId,
    resourceType,
    resourceId
}: {
    orgId: string;
    userId: string;
    resourceType: string;
    resourceId: string;
}): Promise<UserRolePerResource[]> {
    const client = getClient();
    const { data, error } = await client
        .from("UserRolesPerResource")
        .select("*")
        .eq("org_id", orgId)
        .eq("user_id", userId)
        .eq("resource_type", resourceType)
        .eq("resource_id", resourceId);

    if (error) {
        throw new Error(`Failed to get user roles for resource: ${error.message}`);
    }
    return (data ?? []) as UserRolePerResource[];
}

/**
 * Get all roles for a user on a specific resource, returning ResultAsync.
 */
export function getUserRolesForResourceResult({
    orgId,
    userId,
    resourceType,
    resourceId
}: {
    orgId: string;
    userId: string;
    resourceType: string;
    resourceId: string;
}): ResultAsync<UserRolePerResource[], UserPermissionsError> {
    const clientResult = getClientResult();
    if (clientResult.isErr()) {
        return errAsync(clientResult.error);
    }

    const client = clientResult.value;
    return ResultAsync.fromPromise(
        client
            .from("UserRolesPerResource")
            .select("*")
            .eq("org_id", orgId)
            .eq("user_id", userId)
            .eq("resource_type", resourceType)
            .eq("resource_id", resourceId),
        () => supabaseError("QUERY_FAILED", "Failed to get user roles for resource")
    ).andThen(({ data, error }) => {
        if (error) {
            return errAsync(supabaseError("QUERY_FAILED", `Failed to get user roles for resource: ${error.message}`));
        }
        return okAsync((data ?? []) as UserRolePerResource[]);
    });
}

/**
 * Get all users with roles on a specific resource.
 */
export async function getResourceUsers({
    orgId,
    resourceType,
    resourceId
}: {
    orgId: string;
    resourceType: string;
    resourceId: string;
}): Promise<UserRolePerResource[]> {
    const client = getClient();
    const { data, error } = await client
        .from("UserRolesPerResource")
        .select("*")
        .eq("org_id", orgId)
        .eq("resource_type", resourceType)
        .eq("resource_id", resourceId);

    if (error) {
        throw new Error(`Failed to get resource users: ${error.message}`);
    }
    return (data ?? []) as UserRolePerResource[];
}

/**
 * Get all users with roles on a specific resource, returning ResultAsync.
 */
export function getResourceUsersResult({
    orgId,
    resourceType,
    resourceId
}: {
    orgId: string;
    resourceType: string;
    resourceId: string;
}): ResultAsync<UserRolePerResource[], UserPermissionsError> {
    const clientResult = getClientResult();
    if (clientResult.isErr()) {
        return errAsync(clientResult.error);
    }

    const client = clientResult.value;
    return ResultAsync.fromPromise(
        client
            .from("UserRolesPerResource")
            .select("*")
            .eq("org_id", orgId)
            .eq("resource_type", resourceType)
            .eq("resource_id", resourceId),
        () => supabaseError("QUERY_FAILED", "Failed to get resource users")
    ).andThen(({ data, error }) => {
        if (error) {
            return errAsync(supabaseError("QUERY_FAILED", `Failed to get resource users: ${error.message}`));
        }
        return okAsync((data ?? []) as UserRolePerResource[]);
    });
}

/**
 * Add a role for a user on a specific resource.
 */
export async function addUserRoleForResource(input: UserRolePerResourceInsert): Promise<UserRolePerResource> {
    const client = getClient();
    const { data, error } = await client.from("UserRolesPerResource").insert(input).select().single();

    if (error) {
        throw new Error(`Failed to add user role: ${error.message}`);
    }
    return data as UserRolePerResource;
}

/**
 * Add a role for a user on a specific resource, returning ResultAsync.
 */
export function addUserRoleForResourceResult(
    input: UserRolePerResourceInsert
): ResultAsync<UserRolePerResource, UserPermissionsError> {
    const clientResult = getClientResult();
    if (clientResult.isErr()) {
        return errAsync(clientResult.error);
    }

    const client = clientResult.value;
    return ResultAsync.fromPromise(client.from("UserRolesPerResource").insert(input).select().single(), () =>
        supabaseError("INSERT_FAILED", "Failed to add user role")
    ).andThen(({ data, error }) => {
        if (error) {
            return errAsync(supabaseError("INSERT_FAILED", `Failed to add user role: ${error.message}`));
        }
        return okAsync(data as UserRolePerResource);
    });
}

/**
 * Remove a specific role for a user on a resource.
 */
export async function removeUserRoleForResource({
    orgId,
    userId,
    resourceType,
    resourceId,
    role
}: {
    orgId: string;
    userId: string;
    resourceType: string;
    resourceId: string;
    role: ResourceRole;
}): Promise<void> {
    const client = getClient();
    const { error } = await client
        .from("UserRolesPerResource")
        .delete()
        .eq("org_id", orgId)
        .eq("user_id", userId)
        .eq("resource_type", resourceType)
        .eq("resource_id", resourceId)
        .eq("role", role);

    if (error) {
        throw new Error(`Failed to remove user role: ${error.message}`);
    }
}

/**
 * Remove a specific role for a user on a resource, returning ResultAsync.
 */
export function removeUserRoleForResourceResult({
    orgId,
    userId,
    resourceType,
    resourceId,
    role
}: {
    orgId: string;
    userId: string;
    resourceType: string;
    resourceId: string;
    role: ResourceRole;
}): ResultAsync<void, UserPermissionsError> {
    const clientResult = getClientResult();
    if (clientResult.isErr()) {
        return errAsync(clientResult.error);
    }

    const client = clientResult.value;
    return ResultAsync.fromPromise(
        client
            .from("UserRolesPerResource")
            .delete()
            .eq("org_id", orgId)
            .eq("user_id", userId)
            .eq("resource_type", resourceType)
            .eq("resource_id", resourceId)
            .eq("role", role),
        () => supabaseError("DELETE_FAILED", "Failed to remove user role")
    ).andThen(({ error }) => {
        if (error) {
            return errAsync(supabaseError("DELETE_FAILED", `Failed to remove user role: ${error.message}`));
        }
        return okAsync(undefined);
    });
}

/**
 * Remove all roles for a user on a specific resource.
 */
export async function removeAllUserRolesForResource({
    orgId,
    userId,
    resourceType,
    resourceId
}: {
    orgId: string;
    userId: string;
    resourceType: string;
    resourceId: string;
}): Promise<void> {
    const client = getClient();
    const { error } = await client
        .from("UserRolesPerResource")
        .delete()
        .eq("org_id", orgId)
        .eq("user_id", userId)
        .eq("resource_type", resourceType)
        .eq("resource_id", resourceId);

    if (error) {
        throw new Error(`Failed to remove user roles: ${error.message}`);
    }
}

/**
 * Remove all roles for a user on a specific resource, returning ResultAsync.
 */
export function removeAllUserRolesForResourceResult({
    orgId,
    userId,
    resourceType,
    resourceId
}: {
    orgId: string;
    userId: string;
    resourceType: string;
    resourceId: string;
}): ResultAsync<void, UserPermissionsError> {
    const clientResult = getClientResult();
    if (clientResult.isErr()) {
        return errAsync(clientResult.error);
    }

    const client = clientResult.value;
    return ResultAsync.fromPromise(
        client
            .from("UserRolesPerResource")
            .delete()
            .eq("org_id", orgId)
            .eq("user_id", userId)
            .eq("resource_type", resourceType)
            .eq("resource_id", resourceId),
        () => supabaseError("DELETE_FAILED", "Failed to remove user roles")
    ).andThen(({ error }) => {
        if (error) {
            return errAsync(supabaseError("DELETE_FAILED", `Failed to remove user roles: ${error.message}`));
        }
        return okAsync(undefined);
    });
}

// =============================================================================
// Role Permission CRUD Operations
// =============================================================================

/**
 * Get all permissions for a role.
 */
export async function getRolePermissions(role: ResourceRole): Promise<string[]> {
    const client = getClient();
    const { data, error } = await client.from("RolePermissions").select("permission").eq("role", role);

    if (error) {
        throw new Error(`Failed to get role permissions: ${error.message}`);
    }
    return data?.map((r) => r.permission) ?? [];
}

/**
 * Get all permissions for a role, returning ResultAsync.
 */
export function getRolePermissionsResult(role: ResourceRole): ResultAsync<string[], UserPermissionsError> {
    const clientResult = getClientResult();
    if (clientResult.isErr()) {
        return errAsync(clientResult.error);
    }

    const client = clientResult.value;
    return ResultAsync.fromPromise(client.from("RolePermissions").select("permission").eq("role", role), () =>
        supabaseError("QUERY_FAILED", "Failed to get role permissions")
    ).andThen(({ data, error }) => {
        if (error) {
            return errAsync(supabaseError("QUERY_FAILED", `Failed to get role permissions: ${error.message}`));
        }
        return okAsync(data?.map((r) => r.permission) ?? []);
    });
}

/**
 * Get all role-permission mappings.
 */
export async function getAllRolePermissions(): Promise<RolePermission[]> {
    const client = getClient();
    const { data, error } = await client.from("RolePermissions").select("*");

    if (error) {
        throw new Error(`Failed to get all role permissions: ${error.message}`);
    }
    return (data ?? []) as RolePermission[];
}

/**
 * Get all role-permission mappings, returning ResultAsync.
 */
export function getAllRolePermissionsResult(): ResultAsync<RolePermission[], UserPermissionsError> {
    const clientResult = getClientResult();
    if (clientResult.isErr()) {
        return errAsync(clientResult.error);
    }

    const client = clientResult.value;
    return ResultAsync.fromPromise(client.from("RolePermissions").select("*"), () =>
        supabaseError("QUERY_FAILED", "Failed to get all role permissions")
    ).andThen(({ data, error }) => {
        if (error) {
            return errAsync(supabaseError("QUERY_FAILED", `Failed to get all role permissions: ${error.message}`));
        }
        return okAsync((data ?? []) as RolePermission[]);
    });
}

/**
 * Add a permission to a role.
 */
export async function addRolePermission(input: RolePermissionInsert): Promise<RolePermission> {
    const client = getClient();
    const { data, error } = await client.from("RolePermissions").insert(input).select().single();

    if (error) {
        throw new Error(`Failed to add role permission: ${error.message}`);
    }
    return data as RolePermission;
}

/**
 * Add a permission to a role, returning ResultAsync.
 */
export function addRolePermissionResult(
    input: RolePermissionInsert
): ResultAsync<RolePermission, UserPermissionsError> {
    const clientResult = getClientResult();
    if (clientResult.isErr()) {
        return errAsync(clientResult.error);
    }

    const client = clientResult.value;
    return ResultAsync.fromPromise(client.from("RolePermissions").insert(input).select().single(), () =>
        supabaseError("INSERT_FAILED", "Failed to add role permission")
    ).andThen(({ data, error }) => {
        if (error) {
            return errAsync(supabaseError("INSERT_FAILED", `Failed to add role permission: ${error.message}`));
        }
        return okAsync(data as RolePermission);
    });
}

/**
 * Remove a permission from a role.
 */
export async function removeRolePermission({
    role,
    permission
}: {
    role: ResourceRole;
    permission: string;
}): Promise<void> {
    const client = getClient();
    const { error } = await client.from("RolePermissions").delete().eq("role", role).eq("permission", permission);

    if (error) {
        throw new Error(`Failed to remove role permission: ${error.message}`);
    }
}

/**
 * Remove a permission from a role, returning ResultAsync.
 */
export function removeRolePermissionResult({
    role,
    permission
}: {
    role: ResourceRole;
    permission: string;
}): ResultAsync<void, UserPermissionsError> {
    const clientResult = getClientResult();
    if (clientResult.isErr()) {
        return errAsync(clientResult.error);
    }

    const client = clientResult.value;
    return ResultAsync.fromPromise(
        client.from("RolePermissions").delete().eq("role", role).eq("permission", permission),
        () => supabaseError("DELETE_FAILED", "Failed to remove role permission")
    ).andThen(({ error }) => {
        if (error) {
            return errAsync(supabaseError("DELETE_FAILED", `Failed to remove role permission: ${error.message}`));
        }
        return okAsync(undefined);
    });
}

// =============================================================================
// Permission Checking
// =============================================================================

/**
 * Check if a session has fine-grained permissions enabled.
 */
export function hasFineGrainPermission(sessionPermissions: string[]): boolean {
    return sessionPermissions.includes(FINE_GRAIN_PERMISSION);
}

/**
 * Get all permissions a user has for a specific resource based on their roles.
 * Uses a join via subquery to get permissions for the user's roles in a single query.
 */
export async function getUserPermissionsForResource({
    userId,
    orgId,
    resourceType,
    resourceId
}: {
    userId: string;
    orgId: string;
    resourceType: string;
    resourceId: string;
}): Promise<string[]> {
    const client = getClient();

    // Get user's roles for this resource
    const { data: userRoles, error: rolesError } = await client
        .from("UserRolesPerResource")
        .select("role")
        .eq("org_id", orgId)
        .eq("user_id", userId)
        .eq("resource_type", resourceType)
        .eq("resource_id", resourceId);

    if (rolesError) {
        throw new Error(`Failed to get user roles: ${rolesError.message}`);
    }

    if (!userRoles || userRoles.length === 0) {
        return [];
    }

    // Get unique roles
    const roles = [...new Set(userRoles.map((r) => r.role as ResourceRole))];

    // Get permissions for only these roles using IN clause (more efficient than fetching all)
    const { data: rolePermissions, error: permError } = await client
        .from("RolePermissions")
        .select("permission")
        .in("role", roles);

    if (permError) {
        throw new Error(`Failed to get role permissions: ${permError.message}`);
    }

    // Dedupe and return permissions
    return [...new Set(rolePermissions?.map((p) => p.permission) ?? [])];
}

/**
 * Get all permissions a user has for a specific resource based on their roles, returning ResultAsync.
 */
export function getUserPermissionsForResourceResult({
    userId,
    orgId,
    resourceType,
    resourceId
}: {
    userId: string;
    orgId: string;
    resourceType: string;
    resourceId: string;
}): ResultAsync<string[], UserPermissionsError> {
    const clientResult = getClientResult();
    if (clientResult.isErr()) {
        return errAsync(clientResult.error);
    }

    const client = clientResult.value;

    // Get user's roles for this resource
    return ResultAsync.fromPromise(
        client
            .from("UserRolesPerResource")
            .select("role")
            .eq("org_id", orgId)
            .eq("user_id", userId)
            .eq("resource_type", resourceType)
            .eq("resource_id", resourceId),
        () => supabaseError("QUERY_FAILED", "Failed to get user roles")
    ).andThen(({ data: userRoles, error: rolesError }) => {
        if (rolesError) {
            return errAsync(supabaseError("QUERY_FAILED", `Failed to get user roles: ${rolesError.message}`));
        }

        if (!userRoles || userRoles.length === 0) {
            return okAsync<string[], UserPermissionsError>([]);
        }

        // Get unique roles
        const roles = [...new Set(userRoles.map((r) => r.role as ResourceRole))];

        // Get permissions for only these roles using IN clause
        return ResultAsync.fromPromise(client.from("RolePermissions").select("permission").in("role", roles), () =>
            supabaseError("QUERY_FAILED", "Failed to get role permissions")
        ).andThen(({ data: rolePermissions, error: permError }) => {
            if (permError) {
                return errAsync(supabaseError("QUERY_FAILED", `Failed to get role permissions: ${permError.message}`));
            }

            // Dedupe and return permissions
            return okAsync([...new Set(rolePermissions?.map((p) => p.permission) ?? [])]);
        });
    });
}

/**
 * Check if a user has a specific permission for a resource.
 */
export async function hasUserPermissionForResource({
    userId,
    orgId,
    resourceType,
    resourceId,
    permission
}: {
    userId: string;
    orgId: string;
    resourceType: string;
    resourceId: string;
    permission: string;
}): Promise<boolean> {
    const permissions = await getUserPermissionsForResource({
        userId,
        orgId,
        resourceType,
        resourceId
    });
    return permissions.includes(permission);
}

/**
 * Check if a user has a specific permission for a resource, returning ResultAsync.
 */
export function hasUserPermissionForResourceResult({
    userId,
    orgId,
    resourceType,
    resourceId,
    permission
}: {
    userId: string;
    orgId: string;
    resourceType: string;
    resourceId: string;
    permission: string;
}): ResultAsync<boolean, UserPermissionsError> {
    return getUserPermissionsForResourceResult({
        userId,
        orgId,
        resourceType,
        resourceId
    }).map((permissions) => permissions.includes(permission));
}

/**
 * Get all resources of a type that a user has access to.
 */
export async function getUserAccessibleResources({
    userId,
    resourceType
}: {
    userId: string;
    resourceType: string;
}): Promise<string[]> {
    const client = getClient();
    const { data, error } = await client
        .from("UserRolesPerResource")
        .select("resource_id")
        .eq("user_id", userId)
        .eq("resource_type", resourceType);

    if (error) {
        throw new Error(`Failed to get accessible resources: ${error.message}`);
    }

    // Dedupe resource IDs
    const resourceIds = new Set(data?.map((r) => r.resource_id) ?? []);
    return Array.from(resourceIds);
}

/**
 * Get all resources of a type that a user has access to, returning ResultAsync.
 */
export function getUserAccessibleResourcesResult({
    userId,
    resourceType
}: {
    userId: string;
    resourceType: string;
}): ResultAsync<string[], UserPermissionsError> {
    const clientResult = getClientResult();
    if (clientResult.isErr()) {
        return errAsync(clientResult.error);
    }

    const client = clientResult.value;
    return ResultAsync.fromPromise(
        client
            .from("UserRolesPerResource")
            .select("resource_id")
            .eq("user_id", userId)
            .eq("resource_type", resourceType),
        () => supabaseError("QUERY_FAILED", "Failed to get accessible resources")
    ).andThen(({ data, error }) => {
        if (error) {
            return errAsync(supabaseError("QUERY_FAILED", `Failed to get accessible resources: ${error.message}`));
        }

        // Dedupe resource IDs
        const resourceIds = new Set(data?.map((r) => r.resource_id) ?? []);
        return okAsync(Array.from(resourceIds));
    });
}
