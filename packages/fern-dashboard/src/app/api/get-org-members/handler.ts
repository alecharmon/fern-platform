import * as auth0Management from "@/app/services/auth0/management";
import type { Auth0OrgName, Auth0UserID } from "@/app/services/auth0/types";

export default async function getOrgMembers({
    userId,
    orgName,
    permissions
}: {
    userId: Auth0UserID;
    orgName: Auth0OrgName;
    permissions: string[];
}) {
    const members = await auth0Management.getOrgMembers(orgName, {
        includeFernEmployees: auth0Management.isSuperUser(permissions)
    });
    return members;
}
