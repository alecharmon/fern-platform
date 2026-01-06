import type { ManagementClient } from "auth0";

import { getManagementClient } from "./client";
import type { AuthZPermission } from "./permissions";
import type { UserPermissionsResponse } from "./roles";

export interface PermissionRequest {
    client?: ManagementClient;
    userId: string;
    permission: AuthZPermission;
    apiIdentifier: string;
}

export async function addPermission({
    client,
    userId,
    permission,
    apiIdentifier
}: PermissionRequest): Promise<UserPermissionsResponse> {
    const managementClient = client ?? getManagementClient();
    const result = await managementClient.users.assignPermissions(
        { id: userId },
        {
            permissions: [
                {
                    resource_server_identifier: apiIdentifier,
                    permission_name: permission
                }
            ]
        }
    );
    return {
        ...result,
        ok: result.status >= 200 && result.status < 300
    };
}

export async function removePermission({
    client,
    userId,
    permission,
    apiIdentifier
}: PermissionRequest): Promise<UserPermissionsResponse> {
    const managementClient = client ?? getManagementClient();
    const result = await managementClient.users.deletePermissions(
        { id: userId },
        {
            permissions: [
                {
                    resource_server_identifier: apiIdentifier,
                    permission_name: permission
                }
            ]
        }
    );
    return {
        ...result,
        ok: result.status >= 200 && result.status < 300
    };
}
