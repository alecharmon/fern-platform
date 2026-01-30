import { addRoles, getRoles, type Roles, syncOidcPermissions } from "@fern-api/user-permissions";

import type { Auth0OrgID, Auth0UserID } from "@/app/services/auth0/types";

export interface PermissionSyncParams {
    userId: Auth0UserID;
    orgId: Auth0OrgID;
    connection: string;
}

export async function attemptGroupPermSync({ userId, orgId, connection }: PermissionSyncParams): Promise<void> {
    // Sync OIDC group-based permissions
    // This overwrites the user's permissions based on their IdP groups
    try {
        const syncResult = await syncOidcPermissions({
            userId,
            orgId,
            connectionName: connection
        });
        if (syncResult.synced) {
            console.info("Synced OIDC permissions", {
                userId,
                orgId,
                connection,
                changes: syncResult.changes
            });
        }
    } catch (error) {
        // Re-throw redirect errors (Next.js uses these internally)
        if (error && typeof error === "object" && "digest" in error) {
            throw error;
        }
        // Log error but continue
        console.error("Failed to sync OIDC permissions", {
            error,
            orgId,
            userId,
            connection
        });
    }
}

export interface OrgLevelRoleParams {
    userId: Auth0UserID;
    orgId: Auth0OrgID;
    defaultRole: Roles | undefined;
}

export async function attemptOrgLevelRole({ userId, orgId, defaultRole }: OrgLevelRoleParams): Promise<void> {
    const currentRoles = await getRoles({ userId, orgId });
    if (!currentRoles.ok) {
        console.error("Failed to check sso roles", {
            orgId,
            userId
        });
        return;
    }
    if (currentRoles.data.length === 0) {
        // Add default roles
        const addRoleResult = await addRoles({
            userId,
            orgId,
            // for now these are admin roles but will be downgraded
            // to viewer at some point
            roleNames: [defaultRole ?? "editor"]
        });
        if (addRoleResult.ok === false) {
            // Attempt to continue anyways
            console.error("Failed to add roles to user", {
                orgId,
                userId
            });
        }
    }
}
