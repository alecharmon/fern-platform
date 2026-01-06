import type { ResourceType } from "@fern-api/user-permissions";

export interface PermissionScope {
    type: ResourceType;
    id: string;
}

export function docsPermissionScope(id: string): PermissionScope {
    return {
        type: "docs",
        id
    };
}
